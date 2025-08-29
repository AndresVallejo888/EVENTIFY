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
            userId: currentUser.uid, 
            eventName: "Nuevo Evento", 
            eventDate: "", 
            eventStartTime: "",
            eventEndTime: "",
            eventLocation: "", 
            eventTheme: "",
            guestCount: 50,
            budget: { total: 100000, spent: 0 }, 
            vendors: [], 
            savedItems: []
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
        await loadUserEvents();
        renderAll();
    };
    const fetchServices = async () => {
        const snapshot = await db.collection('servicios').get();
        allServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };
    const createTicket = async (total) => {
        if (!activeEvent) return;
        const ticketData = {
            userId: currentUser.uid, 
            userEmail: currentUser.email, 
            eventName: activeEvent.eventName,
            total: total, 
            timestamp: new Date(), 
            vendors: activeEvent.vendors
        };
        await db.collection('tickets').add(ticketData);
    };

    // --- LÓGICA DE CÁLCULO DE PRECIOS ---
    const getVendorCost = (vendor, event) => {
        const service = allServices.find(s => s.id === vendor.id);
        if (!service || !event) return 0;

        switch(service.pricingModel) {
            case 'perHour':
                return service.basePrice * (vendor.duration || 1);
            case 'perPerson':
                return service.basePrice * (event.guestCount || 50);
            case 'flat':
            default:
                return service.basePrice;
        }
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
        const spent = activeEvent.vendors.reduce((sum, v) => sum + getVendorCost(v, activeEvent), 0);
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

        const vendorsHTML = activeEvent.vendors.map(vendor => {
            const service = allServices.find(s => s.id === vendor.id);
            const finalPrice = getVendorCost(vendor, activeEvent);
            const noteHTML = vendor.notes ? `<small class="vendor-note">Nota: ${vendor.notes}</small>` : '';

            let durationHTML = '';
            if (service && service.pricingModel === 'perHour') {
                durationHTML = `
                    <div class="duration-control">
                        <input type="number" class="js-update-duration" data-id="${vendor.id}" value="${vendor.duration || 1}" min="1">
                        <span>hrs</span>
                    </div>
                `;
            }

            return `
                <li>
                    <div class="vendor-info">
                        <span><strong>${vendor.name}</strong><br><small>${vendor.providerName}</small></span>
                        ${noteHTML}
                    </div>
                    <div class="vendor-actions">
                        <span class="vendor-price">$${finalPrice.toLocaleString()}</span>
                        ${durationHTML}
                        <button class="btn-secondary btn-small js-edit-note" data-id="${vendor.id}">Nota</button>
                        <button class="delete-vendor-btn" data-id="${vendor.id}" title="Eliminar proveedor"><i data-feather="x-circle"></i></button>
                    </div>
                </li>
            `;
        }).join('') || '<li>No has contratado proveedores para este evento.</li>';
        
        container.innerHTML = `<ul class="vendor-list">${vendorsHTML}</ul>`;
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
        const filteredServices = allServices.filter(s => s.name.toLowerCase().includes(searchTerm) || s.providerName.toLowerCase().includes(searchTerm));
        const grouped = filteredServices.reduce((acc, s) => { (acc[s.categoryTitle] = acc[s.categoryTitle] || []).push(s); return acc; }, {});
        container.innerHTML = Object.keys(grouped).map(category => `
            <section><h2>${category}</h2><div class="services-grid">${grouped[category].map(createServiceCardHTML).join('')}</div></section>
        `).join('');
    };
    const createServiceCardHTML = (service) => {
        const isAdded = activeEvent && activeEvent.vendors.some(v => v.id === service.id);
        const isSaved = activeEvent && activeEvent.savedItems.includes(service.id);
        return `<div class="service-card" data-id="${service.id}">
            <img src="${service.image}" alt="${service.name}" class="service-card-img">
            <div class="service-card-content">
                <h3>${service.name}</h3><p>${service.providerName || ''} • Desde $${(service.basePrice || 0).toLocaleString()}</p>
                <div class="service-card-actions">
                    <button class="card-btn btn-secondary js-save-item ${isSaved ? 'active' : ''}"><i data-feather="heart"></i> ${isSaved ? 'Guardado' : 'Guardar'}</button>
                    <button class="card-btn btn-primary js-add-item" ${isAdded ? 'disabled' : ''}>${isAdded ? 'Añadido' : 'Añadir'}</button>
                </div></div></div>`;
    };
    const renderPresupuestoView = () => {
        const container = document.getElementById('budget-details-content');
        if (!activeEvent) {
            container.innerHTML = "<p>Selecciona un evento para ver el detalle del presupuesto.</p>";
            return;
        }

        const total = activeEvent.budget.total || 0;
        const spent = activeEvent.vendors.reduce((sum, v) => sum + getVendorCost(v, activeEvent), 0);
        activeEvent.budget.spent = spent;
        const remaining = total - spent;
        const percentage = total > 0 ? (spent / total) * 100 : 0;

        const vendorsHTML = activeEvent.vendors.length > 0
            ? activeEvent.vendors.map(vendor => `
                <li>
                    <span><strong>${vendor.name}</strong><br><small>${vendor.providerName}</small></span>
                    <span>$${getVendorCost(vendor, activeEvent).toLocaleString()}</span>
                </li>
            `).join('')
            : '<li>Aún no has contratado servicios.</li>';

        container.innerHTML = `
            <div class="budget-summary">
                <div class="summary-item">
                    <h4>Presupuesto Total</h4>
                    <p>$${total.toLocaleString()}</p>
                </div>
                <div class="summary-item">
                    <h4>Gastado</h4>
                    <p class="spent-text">$${spent.toLocaleString()}</p>
                </div>
                <div class="summary-item">
                    <h4>Restante</h4>
                    <p class="remaining-text">$${remaining.toLocaleString()}</p>
                </div>
            </div>
            <div class="progress-bar" style="margin-top: 20px; margin-bottom: 30px;">
                <div class="progress" style="width: ${percentage}%;"></div>
            </div>
            <h3>Desglose de Gastos</h3>
            <ul class="vendor-list">${vendorsHTML}</ul>
        `;
    };
    const renderCartModal = () => {
        if (!activeEvent) return;
        let subtotal = activeEvent.vendors.reduce((sum, v) => sum + getVendorCost(v, activeEvent), 0);
        const itemsHTML = activeEvent.vendors.map(vendor => {
            return `<div class="cart-item"><span>${vendor.name}</span><span>$${getVendorCost(vendor, activeEvent).toLocaleString()}</span></div>`;
        }).join('');
        const iva = subtotal * 0.16;
        const total = subtotal + iva;
        openModal('Carrito de Compras', `<div class="cart-items">${itemsHTML || '<p>Aún no has añadido servicios.</p>'}</div>
            <div class="cart-total"><p>Subtotal: <strong>$${subtotal.toLocaleString()}</strong></p><p>IVA (16%): <strong>$${iva.toLocaleString()}</strong></p><hr><p>Total: <strong>$${total.toLocaleString()}</strong></p></div>
            <button class="btn-primary" id="generate-payment-btn" ${subtotal === 0 ? 'disabled' : ''}>Generar Ficha de Pago</button>`);
    };
    const renderPaymentSlipModal = (total) => {
        const msi = (total / 12).toFixed(2);
        openModal('Ficha de Pago', `<div class="payment-slip"><h3>Realizar Transferencia Bancaria</h3><p><strong>Beneficiario:</strong> Eventify S.A. de C.V.</p><p><strong>Banco:</strong> BBVA México</p><p><strong>CLABE:</strong> 012 345 67890123456 7</p><p><strong>Monto a Pagar:</strong> $${total.toLocaleString()}</p><hr><p>O paga a <strong>12 meses sin intereses</strong> de $${msi.toLocaleString()} con tarjetas participantes.</p></div>`);
    };

    // --- MANEJO DE VISTAS Y MODALES ---
    const switchView = (viewName) => { document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active')); document.getElementById(`view-${viewName}`).classList.add('active'); document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active')); document.querySelector(`.nav-link[data-view="${viewName}"]`).classList.add('active'); };
    const openModal = (title, bodyHTML) => { modalBody.innerHTML = `<h2>${title}</h2>${bodyHTML}`; modalContainer.classList.add('visible'); };
    const closeModal = () => modalContainer.classList.remove('visible');

    // --- EVENT LISTENERS ---
    document.body.addEventListener('click', async (e) => {
        const navLink = e.target.closest('.nav-link'); if (navLink) { e.preventDefault(); switchView(navLink.dataset.view); }
        if (e.target.closest('#logout-btn')) { auth.signOut(); }
        if (e.target.closest('#create-event-btn')) { await createNewEvent(); }
        if (e.target.closest('#cart-button')) { renderCartModal(); }
        if (e.target.closest('#modal-close-btn') || e.target === modalContainer) { closeModal(); }
        
        if (e.target.id === 'generate-payment-btn' && activeEvent) {
            const subtotal = activeEvent.vendors.reduce((sum, v) => getVendorCost(v, activeEvent), 0);
            const total = subtotal * 1.16;
            await createTicket(total);
            renderPaymentSlipModal(total);
        }

        const deleteEventBtn = e.target.closest('.js-delete-event');
        if (deleteEventBtn) {
            const eventId = deleteEventBtn.dataset.id;
            const eventToDelete = userEvents.find(e => e.id === eventId);
            if (confirm(`¿Estás seguro de que quieres eliminar el evento "${eventToDelete.eventName}"?`)) {
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
            openModal('Editar Detalles del Evento', `<form id="event-details-form" data-id="${eventToEdit.id}">
                <div class="form-group"><label>Nombre del Evento</label><input type="text" id="modal-event-name" value="${eventToEdit.eventName}"></div>
                <div class="form-group"><label>Temática del Evento</label><input type="text" id="modal-event-theme" value="${eventToEdit.eventTheme || ''}"></div>
                <div class="form-row">
                    <div class="form-group"><label>Fecha</label><input type="date" id="modal-event-date" value="${eventToEdit.eventDate || ''}"></div>
                    <div class="form-group"><label>Invitados</label><input type="number" id="modal-guest-count" value="${eventToEdit.guestCount || 50}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Hora de Inicio</label><input type="time" id="modal-event-start-time" value="${eventToEdit.eventStartTime || ''}"></div>
                    <div class="form-group"><label>Hora de Fin</label><input type="time" id="modal-event-end-time" value="${eventToEdit.eventEndTime || ''}"></div>
                </div>
                <div class="form-group"><label>Ubicación</label><input type="text" id="modal-event-location" value="${eventToEdit.eventLocation || ''}"></div>
                <button type="submit" class="btn-primary">Guardar Cambios</button>
            </form>`);
        }
        
        const editBudgetBtn = e.target.closest('#edit-budget-btn');
        if(editBudgetBtn && activeEvent){ openModal('Editar Presupuesto Total', `<form id="budget-edit-form"><div class="form-group"><label>Nuevo Presupuesto</label><input type="number" id="new-budget" value="${activeEvent.budget.total}"></div><button type="submit" class="btn-primary">Guardar</button></form>`); }
        
        const saveItemBtn = e.target.closest('.js-save-item');
        if (saveItemBtn && activeEvent) { const serviceId = saveItemBtn.closest('.service-card').dataset.id; const index = activeEvent.savedItems.indexOf(serviceId); if (index > -1) { activeEvent.savedItems.splice(index, 1); } else { activeEvent.savedItems.push(serviceId); } await saveActiveEvent(); renderAll(); }
        
        const addItemBtn = e.target.closest('.js-add-item');
        if(addItemBtn && !addItemBtn.disabled && activeEvent){ const serviceId = addItemBtn.closest('.service-card').dataset.id; const service = allServices.find(s => s.id === serviceId); if (service) { activeEvent.vendors.push({ id: service.id, name: service.name, price: service.basePrice, providerName: service.providerName, notes: '', duration: 1 }); await saveActiveEvent(); renderAll(); } }
        
        const deleteVendorBtn = e.target.closest('.delete-vendor-btn');
        if (deleteVendorBtn && activeEvent) { const vendorId = deleteVendorBtn.dataset.id; activeEvent.vendors = activeEvent.vendors.filter(v => v.id !== vendorId); await saveActiveEvent(); renderAll(); }

        const editNoteBtn = e.target.closest('.js-edit-note');
        if (editNoteBtn && activeEvent) {
            const vendorId = editNoteBtn.dataset.id;
            const vendorToEdit = activeEvent.vendors.find(v => v.id === vendorId);
            if (vendorToEdit) {
                openModal(`Nota para ${vendorToEdit.name}`, `
                    <form id="vendor-note-form" data-id="${vendorId}">
                        <div class="form-group">
                            <label for="modal-vendor-note">Escribe tus apuntes, acuerdos o recordatorios:</label>
                            <textarea id="modal-vendor-note" rows="5" class="form-control-textarea">${vendorToEdit.notes || ''}</textarea>
                        </div>
                        <button type="submit" class="btn-primary">Guardar Nota</button>
                    </form>
                `);
            }
        }
    });

    document.getElementById('search-input').addEventListener('input', renderServices);

    document.body.addEventListener('change', async (e) => {
        if (e.target.classList.contains('js-update-duration')) {
            const vendorId = e.target.dataset.id;
            const newDuration = parseInt(e.target.value, 10);
            if (activeEvent && newDuration > 0) {
                const vendorToUpdate = activeEvent.vendors.find(v => v.id === vendorId);
                if (vendorToUpdate) {
                    vendorToUpdate.duration = newDuration;
                    await saveActiveEvent();
                    renderAll();
                }
            }
        }
    });

    modalContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.target.id === 'event-details-form') {
            const eventId = e.target.dataset.id; 
            const eventToUpdate = userEvents.find(event => event.id === eventId);
            if(eventToUpdate){
                eventToUpdate.eventName = document.getElementById('modal-event-name').value;
                eventToUpdate.eventTheme = document.getElementById('modal-event-theme').value;
                eventToUpdate.eventDate = document.getElementById('modal-event-date').value;
                eventToUpdate.eventStartTime = document.getElementById('modal-event-start-time').value;
                eventToUpdate.eventEndTime = document.getElementById('modal-event-end-time').value;
                eventToUpdate.eventLocation = document.getElementById('modal-event-location').value;
                eventToUpdate.guestCount = parseInt(document.getElementById('modal-guest-count').value, 10);
                activeEvent = eventToUpdate; 
                await saveActiveEvent(); 
                renderAll(); 
                closeModal();
            }
        }
        if (e.target.id === 'budget-edit-form') {
            const newTotal = parseFloat(document.getElementById('new-budget').value);
            if (activeEvent && newTotal >= 0) { activeEvent.budget.total = newTotal; await saveActiveEvent(); renderAll(); closeModal(); }
        }
        if (e.target.id === 'vendor-note-form') {
            const vendorId = e.target.dataset.id;
            const vendorToUpdate = activeEvent.vendors.find(v => v.id === vendorId);
            if (vendorToUpdate) {
                vendorToUpdate.notes = document.getElementById('modal-vendor-note').value;
                await saveActiveEvent();
                renderAll();
                closeModal();
            }
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