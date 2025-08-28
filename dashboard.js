// --- CONFIGURACIÓN E INICIALIZACIÓN ---
const firebaseConfig = { apiKey: "AIzaSyDNfKVpCw1cf1geCTzfmMSL1-gtVFy9sjs", authDomain: "eventify-70dbc.firebaseapp.com", projectId: "eventify-70dbc", storageBucket: "eventify-70dbc.appspot.com", messagingSenderId: "489645350340", appId: "1:489645350340:web:f1389c69d8498bb5325891" };
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO GLOBAL DE LA APLICACIÓN ---
    let currentUser, userEvents = [], activeEvent = null, allServices = [];

    // --- ELEMENTOS DEL DOM ---
    const modalContainer = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');

    // --- MANEJO DE AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            initApp();
        } else {
            window.location.href = "index.html";
        }
    });

    // --- LÓGICA DE FIRESTORE ---
    const loadUserEvents = async () => {
        const snapshot = await db.collection('events').where('userId', '==', currentUser.uid).get();
        userEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        activeEvent = userEvents.length > 0 ? userEvents[0] : null;
    };
    const saveActiveEvent = async () => {
        if (!currentUser || !activeEvent) return;
        const eventData = { ...activeEvent };
        delete eventData.id;
        await db.collection('events').doc(activeEvent.id).set(eventData);
    };
    const createNewEvent = async () => {
        const newEventData = {
            userId: currentUser.uid, eventName: "Nuevo Evento", eventDate: "", eventLocation: "",
            budget: { total: 100000, spent: 0 }, vendors: [], savedItems: []
        };
        const docRef = await db.collection('events').add(newEventData);
        const newEvent = { id: docRef.id, ...newEventData };
        userEvents.push(newEvent);
        activeEvent = newEvent;
        renderAll();
        switchView('mi-evento');
    };
    const deleteEvent = async (eventId) => {
        await db.collection('events').doc(eventId).delete();
        await loadUserEvents(); // Recarga la lista de eventos actualizada
        renderAll();
    };
    const fetchServices = async () => {
        const snapshot = await db.collection('servicios').get();
        allServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    // --- LÓGICA DE RENDERIZADO ---
    const renderAll = () => {
        renderEventOverview(); renderMiEventoView(); renderProveedoresView();
        renderGuardadosView(); renderServices(); renderPresupuestoView();
        feather.replace();
    };
    const renderEventOverview = () => {
        document.getElementById('user-name-display').textContent = currentUser.displayName || currentUser.email;
        if (!activeEvent) {
            document.getElementById('active-event-title').textContent = "Crea o selecciona un evento";
            document.getElementById('active-event-date').textContent = "para empezar a planificar";
            document.getElementById('budget-remaining').textContent = '$...';
            document.getElementById('budget-progress').style.width = '0%';
            document.getElementById('vendors-count').textContent = '...';
            return;
        }
        const spent = activeEvent.vendors.reduce((sum, v) => sum + v.price, 0);
        activeEvent.budget.spent = spent;
        const remaining = activeEvent.budget.total - spent;
        document.getElementById('active-event-title').textContent = activeEvent.eventName;
        document.getElementById('active-event-date').textContent = activeEvent.eventDate || 'Sin fecha definida';
        document.getElementById('budget-remaining').textContent = `$${remaining.toLocaleString()}`;
        document.getElementById('budget-progress').style.width = `${(spent / activeEvent.budget.total) * 100}%`;
        document.getElementById('vendors-count').textContent = activeEvent.vendors.length;
    };
    const renderMiEventoView = () => {
        const container = document.getElementById('events-list-container');
        if (userEvents.length === 0) { container.innerHTML = "<p>Aún no has creado ningún evento. ¡Haz clic en 'Crear Nuevo Evento' para empezar!</p>"; return; }
        container.innerHTML = userEvents.map(event => `
            <div class="event-card ${activeEvent && event.id === activeEvent.id ? 'active' : ''}" data-id="${event.id}">
                <button class="delete-event-btn js-delete-event" data-id="${event.id}" title="Eliminar evento">&times;</button>
                <div class="event-card-info js-select-event" data-id="${event.id}">
                    <h3>${event.eventName}</h3><p>${event.eventDate || 'Sin fecha'}</p>
                </div>
                <div class="event-card-actions">
                    <button class="btn-secondary btn-small js-edit-event" data-id="${event.id}">Editar</button>
                </div>
            </div>`).join('');
    };
    const renderProveedoresView = () => {
        const container = document.getElementById('vendors-list-content');
        if (!activeEvent) { container.innerHTML = "<p>Selecciona un evento para ver sus proveedores.</p>"; return; }
        container.innerHTML = `<ul class="vendor-list">${activeEvent.vendors.map(vendor => `
            <li><span><strong>${vendor.name}</strong><br><small>${vendor.providerName}</small></span>
            <span>$${vendor.price.toLocaleString()}</span><button class="delete-vendor-btn" data-id="${vendor.id}"><i data-feather="x-circle"></i></button></li>
        `).join('') || '<li>No has contratado proveedores para este evento.</li>'}</ul>`;
    };
    const renderGuardadosView = () => {
        const container = document.getElementById('saved-items-content');
        if (!activeEvent) { container.innerHTML = "<p>Selecciona un evento para ver sus elementos guardados.</p>"; return; }
        const savedServices = activeEvent.savedItems.map(savedId => allServices.find(s => s.id === savedId)).filter(Boolean);
        if(savedServices.length === 0) { container.innerHTML = '<p>Aún no has guardado ningún servicio para este evento.</p>'; return; }
        container.innerHTML = `<div class="services-grid">${savedServices.map(createServiceCardHTML).join('')}</div>`;
    };
    const renderServices = () => {
        const container = document.getElementById('services-content');
        if (!activeEvent) { container.innerHTML = "<h2>Selecciona un evento para añadir servicios</h2>"; return; }
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const filteredServices = allServices.filter(s => s.name.toLowerCase().includes(searchTerm));
        container.innerHTML = `<h2>Explorar Servicios</h2><div class="services-grid">${filteredServices.map(createServiceCardHTML).join('')}</div>`;
    };
    const createServiceCardHTML = (service) => {
        const isAdded = activeEvent && activeEvent.vendors.some(v => v.id === service.id);
        const isSaved = activeEvent && activeEvent.savedItems.includes(service.id);
        return `<div class="service-card" data-id="${service.id}">
            <img src="${service.image}" alt="${service.name}" class="service-card-img">
            <div class="service-card-content">
                <h3>${service.name}</h3><p>${service.providerName || ''} • Desde $${(service.price || 0).toLocaleString()}</p>
                <div class="service-card-actions">
                    <button class="card-btn btn-secondary js-save-item ${isSaved ? 'active' : ''}"><i data-feather="heart"></i> ${isSaved ? 'Guardado' : 'Guardar'}</button>
                    <button class="card-btn btn-primary js-add-item" ${isAdded ? 'disabled' : ''}>${isAdded ? 'Añadido' : 'Añadir'}</button>
                </div></div></div>`;
    };
    const renderPresupuestoView = () => { /* Similar a Proveedores */ };

    // --- MANEJO DE VISTAS Y MODALES ---
    const switchView = (viewName) => { document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active')); document.getElementById(`view-${viewName}`).classList.add('active'); document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active')); document.querySelector(`.nav-link[data-view="${viewName}"]`).classList.add('active'); };
    const openModal = (title, bodyHTML) => { modalBody.innerHTML = `<h2>${title}</h2>${bodyHTML}`; modalContainer.classList.add('visible'); };
    const closeModal = () => modalContainer.classList.remove('visible');

    // --- EVENT LISTENERS ---
    document.body.addEventListener('click', async (e) => {
        const navLink = e.target.closest('.nav-link'); if (navLink) { e.preventDefault(); switchView(navLink.dataset.view); }
        if (e.target.closest('#logout-btn')) { auth.signOut(); }
        if (e.target.closest('#create-event-btn')) { await createNewEvent(); }
        if (e.target.closest('#modal-close-btn') || e.target === modalContainer) { closeModal(); }
        
        const deleteEventBtn = e.target.closest('.js-delete-event');
        if (deleteEventBtn) {
            const eventId = deleteEventBtn.dataset.id;
            const eventToDelete = userEvents.find(e => e.id === eventId);
            if (confirm(`¿Estás seguro de que quieres eliminar el evento "${eventToDelete.eventName}"? Esta acción no se puede deshacer.`)) {
                await deleteEvent(eventId);
            }
        }
        
        const selectEvent = e.target.closest('.js-select-event');
        if (selectEvent && (!activeEvent || selectEvent.dataset.id !== activeEvent.id)) {
            activeEvent = userEvents.find(event => event.id === selectEvent.dataset.id);
            renderAll();
        }

        const editEventBtn = e.target.closest('.js-edit-event');
        if (editEventBtn) {
            const eventToEdit = userEvents.find(event => event.id === editEventBtn.dataset.id);
            openModal('Editar Detalles del Evento', `<form id="event-details-form" data-id="${eventToEdit.id}"><div class="form-group"><label>Nombre</label><input type="text" id="modal-event-name" value="${eventToEdit.eventName}"></div><div class="form-row"><div class="form-group"><label>Fecha</label><input type="date" id="modal-event-date" value="${eventToEdit.eventDate}"></div><div class="form-group"><label>Ubicación</label><input type="text" id="modal-event-location" value="${eventToEdit.eventLocation || ''}"></div></div><button type="submit" class="btn-primary">Guardar Cambios</button></form>`);
        }
        
        const editBudgetBtn = e.target.closest('#edit-budget-btn');
        if(editBudgetBtn && activeEvent){ openModal('Editar Presupuesto Total', `<form id="budget-edit-form"><div class="form-group"><label>Nuevo Presupuesto</label><input type="number" id="new-budget" value="${activeEvent.budget.total}"></div><button type="submit" class="btn-primary">Guardar</button></form>`); }
        
        const saveItemBtn = e.target.closest('.js-save-item');
        if (saveItemBtn && activeEvent) { const serviceId = saveItemBtn.closest('.service-card').dataset.id; const index = activeEvent.savedItems.indexOf(serviceId); if (index > -1) { activeEvent.savedItems.splice(index, 1); } else { activeEvent.savedItems.push(serviceId); } await saveActiveEvent(); renderAll(); }
        
        const addItemBtn = e.target.closest('.js-add-item');
        if(addItemBtn && !addItemBtn.disabled && activeEvent){ const serviceId = addItemBtn.closest('.service-card').dataset.id; const service = allServices.find(s => s.id === serviceId); if (service) { activeEvent.vendors.push({ id: service.id, name: service.name, price: service.price, providerName: service.providerName }); await saveActiveEvent(); renderAll(); } }
        
        const deleteVendorBtn = e.target.closest('.delete-vendor-btn');
        if (deleteVendorBtn && activeEvent) { const vendorId = deleteVendorBtn.dataset.id; activeEvent.vendors = activeEvent.vendors.filter(v => v.id !== vendorId); await saveActiveEvent(); renderAll(); }
    });

    modalContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.target.id === 'event-details-form') {
            const eventId = e.target.dataset.id; const eventToUpdate = userEvents.find(event => event.id === eventId);
            if(eventToUpdate){
                eventToUpdate.eventName = document.getElementById('modal-event-name').value;
                eventToUpdate.eventDate = document.getElementById('modal-event-date').value;
                eventToUpdate.eventLocation = document.getElementById('modal-event-location').value;
                activeEvent = eventToUpdate; await saveActiveEvent(); renderAll(); closeModal();
            }
        }
        if (e.target.id === 'budget-edit-form') {
            const newTotal = parseFloat(document.getElementById('new-budget').value);
            if (activeEvent && newTotal >= 0) { activeEvent.budget.total = newTotal; await saveActiveEvent(); renderAll(); closeModal(); }
        }
    });
    
    // --- INICIALIZACIÓN DE LA APP ---
    const initApp = async () => {
        try {
            await Promise.all([fetchServices(), loadUserEvents()]);
            renderAll();
        } catch (error) {
            console.error("ERROR CRÍTICO AL INICIALIZAR LA APP:", error);
            document.querySelector('.main-content').innerHTML = `<h1>Oops! Algo salió mal.</h1><p>No se pudieron cargar los datos. Revisa la consola (F12) para ver los errores y asegúrate de que el índice de Firestore esté creado.</p>`;
        }
    };
});