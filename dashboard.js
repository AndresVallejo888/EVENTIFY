// --- CONFIGURACIÓN E INICIALIZACIÓN ---
const firebaseConfig = { apiKey: "AIzaSyDNfKVpCw1cf1geCTzfmMSL1-gtVFy9sjs", authDomain: "eventify-70dbc.firebaseapp.com", projectId: "eventify-70dbc", storageBucket: "eventify-70dbc.appspot.com", messagingSenderId: "489645350340", appId: "1:489645350340:web:f1389c69d8498bb5325891" };
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    let currentUser;
    let eventState = {};
    let allServices = [];

    // --- MANEJO DE AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            init();
        } else {
            window.location.href = "index.html";
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    // --- LÓGICA DE FIRESTORE: LEER Y GUARDAR DATOS ---
    async function loadEventState() {
        const eventRef = db.collection('events').doc(currentUser.uid);
        const doc = await eventRef.get();
        if (doc.exists) {
            eventState = doc.data();
        } else {
            eventState = {
                eventName: "Mi Nuevo Evento", eventDate: "", eventLocation: "",
                budget: { total: 50000, spent: 0 },
                checklist: [{ text: 'Definir fecha y lugar', completed: false }, { text: 'Contratar fotógrafo', completed: false }],
                vendors: [], savedItems: []
            };
            await saveEventState();
        }
    }
    async function saveEventState() {
        if (!currentUser) return;
        await db.collection('events').doc(currentUser.uid).set(eventState);
    }
    async function fetchServices() {
        const snapshot = await db.collection('servicios').get();
        allServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // --- LÓGICA DE RENDERIZADO (DIBUJA LA UI) ---
    function renderAll() {
        renderEventOverview(); renderMiEventoView(); renderPresupuestoView(); renderChecklistView();
        renderProveedoresView(); renderGuardadosView(); renderServices(document.querySelector('.nav-link.active')?.dataset.view);
        feather.replace();
    }
    const renderEventOverview = () => {
        const spent = eventState.vendors.reduce((sum, v) => sum + v.price, 0);
        eventState.budget.spent = spent;
        document.getElementById('budget-spent').textContent = `$${spent.toLocaleString()}`;
        document.getElementById('budget-total').textContent = `$${eventState.budget.total.toLocaleString()}`;
        document.getElementById('budget-progress').style.width = `${(spent / eventState.budget.total) * 100}%`;
        const completedTasks = eventState.checklist.filter(t => t.completed).length;
        document.getElementById('checklist-completed').textContent = completedTasks;
        document.getElementById('checklist-total').textContent = eventState.checklist.length;
        document.getElementById('vendors-count').textContent = eventState.vendors.length;
        document.getElementById('user-name-display').textContent = currentUser.displayName || currentUser.email;
    };
    const renderMiEventoView = () => {
        document.getElementById('event-name').value = eventState.eventName || "";
        document.getElementById('event-date').value = eventState.eventDate || "";
        document.getElementById('event-location').value = eventState.eventLocation || "";
    };
    const renderPresupuestoView = () => {
        const content = document.getElementById('budget-details-content');
        content.innerHTML = `<ul class="vendor-list">${eventState.vendors.map(v => `<li><span>${v.name}</span><span>$${v.price.toLocaleString()}</span></li>`).join('') || '<li>Aún no has contratado proveedores.</li>'}</ul>`;
    };
    const renderChecklistView = () => {
        const container = document.getElementById('checklist-container');
        container.innerHTML = eventState.checklist.map((task, index) => `
            <li>
                <input type="checkbox" id="task-${index}" data-index="${index}" ${task.completed ? 'checked' : ''}>
                <label for="task-${index}" class="${task.completed ? 'completed' : ''}">${task.text}</label>
                <button class="delete-task-btn" data-index="${index}"><i data-feather="trash-2"></i></button>
            </li>`).join('');
    };
    const renderProveedoresView = () => { /* Similar a Presupuesto, puedes detallar más aquí */ };
    const renderGuardadosView = () => {
        const savedServices = eventState.savedItems.map(savedId => allServices.find(s => s.id === savedId)).filter(Boolean);
        document.getElementById('saved-items-content').innerHTML = `<div class="services-grid">${savedServices.map(service => createServiceCardHTML(service)).join('')}</div>`;
    };
    const renderServices = () => {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const filteredServices = allServices.filter(s => s.name.toLowerCase().includes(searchTerm));
        document.getElementById('services-content').innerHTML = `<div class="services-grid">${filteredServices.map(service => createServiceCardHTML(service)).join('')}</div>`;
    };
    const createServiceCardHTML = (service) => {
        const isSaved = eventState.savedItems.includes(service.id);
        const isAdded = eventState.vendors.some(v => v.id === service.id);
        return `<div class="service-card" data-id="${service.id}">
            <img src="${service.image}" alt="${service.name}" class="service-card-img">
            <div class="service-card-content">
                <h3>${service.name}</h3>
                <p>${service.categoryTitle} • Desde $${service.price.toLocaleString()}</p>
                <div class="service-card-actions">
                    <button class="card-btn btn-secondary js-save-item ${isSaved ? 'active' : ''}"><i data-feather="heart"></i> ${isSaved ? 'Guardado' : 'Guardar'}</button>
                    <button class="card-btn btn-primary js-add-item" ${isAdded ? 'disabled' : ''}><i data-feather="plus"></i> ${isAdded ? 'Añadido' : 'Añadir'}</button>
                </div></div></div>`;
    };

    // --- MANEJO DE VISTAS Y MODALES ---
    const switchView = (viewName) => {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav-link[data-view="${viewName}"]`).classList.add('active');
    };
    const modalContainer = document.getElementById('modal-container');
    const openModal = (contentHTML) => { modalContainer.querySelector('#modal-body').innerHTML = contentHTML; modalContainer.classList.add('visible'); };
    const closeModal = () => modalContainer.classList.remove('visible');

    // --- EVENT LISTENERS ---
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', e => { e.preventDefault(); switchView(link.dataset.view); }));
    document.getElementById('search-input').addEventListener('input', renderServices);
    document.getElementById('event-details-form').addEventListener('submit', async e => { e.preventDefault(); eventState.eventName = document.getElementById('event-name').value; eventState.eventDate = document.getElementById('event-date').value; eventState.eventLocation = document.getElementById('event-location').value; await saveEventState(); alert("¡Detalles guardados!"); renderAll(); });
    document.getElementById('edit-budget-btn').addEventListener('click', () => openModal(`<form id="budget-edit-form"><h2>Editar Presupuesto Total</h2><div class="form-group"><input type="number" id="new-budget" value="${eventState.budget.total}"></div><button type="submit" class="btn-primary">Guardar</button></form>`));
    document.getElementById('add-task-form').addEventListener('submit', async e => { e.preventDefault(); const input = document.getElementById('new-task-input'); if(input.value) { eventState.checklist.push({ text: input.value, completed: false }); input.value = ''; await saveEventState(); renderAll(); } });
    document.body.addEventListener('click', async e => {
        const saveBtn = e.target.closest('.js-save-item');
        const addBtn = e.target.closest('.js-add-item');
        const checkTask = e.target.closest('input[type="checkbox"]');
        const deleteTask = e.target.closest('.delete-task-btn');
        if (saveBtn) { const id = saveBtn.closest('.service-card').dataset.id; const index = eventState.savedItems.indexOf(id); if (index > -1) { eventState.savedItems.splice(index, 1); } else { eventState.savedItems.push(id); } await saveEventState(); renderAll(); }
        if (addBtn) { const id = addBtn.closest('.service-card').dataset.id; const service = allServices.find(s => s.id === id); if (service) { eventState.vendors.push({ id: service.id, name: service.name, price: service.price }); await saveEventState(); renderAll(); } }
        if (checkTask) { const index = checkTask.dataset.index; eventState.checklist[index].completed = checkTask.checked; await saveEventState(); renderAll(); }
        if (deleteTask) { const index = deleteTask.dataset.index; eventState.checklist.splice(index, 1); await saveEventState(); renderAll(); }
    });
    modalContainer.addEventListener('submit', async e => { if (e.target.id === 'budget-edit-form') { e.preventDefault(); const newTotal = parseFloat(document.getElementById('new-budget').value); if (newTotal > 0) { eventState.budget.total = newTotal; await saveEventState(); renderAll(); closeModal(); } } });
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);

    // --- INICIALIZACIÓN DE LA APP ---
    async function init() {
        await loadEventState();
        await fetchServices();
        renderAll();
    }
});