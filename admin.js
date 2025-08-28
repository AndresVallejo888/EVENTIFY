const firebaseConfig = { apiKey: "AIzaSyDNfKVpCw1cf1geCTzfmMSL1-gtVFy9sjs", authDomain: "eventify-70dbc.firebaseapp.com", projectId: "eventify-70dbc", storageBucket: "eventify-70dbc.appspot.com", messagingSenderId: "489645350340", appId: "1:489645350340:web:f1389c69d8498bb5325891" };
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- GUARDIA DE SEGURIDAD: SOLO ADMINS PUEDEN ESTAR AQUÍ ---
auth.onAuthStateChanged(async user => {
    if (user) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
            console.log("Acceso de administrador concedido.");
            loadServices();
        } else {
            alert("Acceso denegado. No eres administrador.");
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'admin.html';
    }
});

// --- LÓGICA PARA AÑADIR Y VER SERVICIOS ---
const addServiceForm = document.getElementById('add-service-form');
addServiceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoryOption = document.getElementById('service-category');
    const newService = {
        name: document.getElementById('service-name').value,
        providerName: document.getElementById('service-provider').value,
        price: parseFloat(document.getElementById('service-price').value),
        image: document.getElementById('service-image').value,
        category: categoryOption.value,
        categoryTitle: categoryOption.options[categoryOption.selectedIndex].text
    };
    try {
        await db.collection('servicios').add(newService);
        alert("¡Servicio añadido con éxito!");
        addServiceForm.reset();
        loadServices();
    } catch (error) {
        console.error("Error añadiendo servicio:", error);
    }
});

async function loadServices() {
    const servicesList = document.getElementById('services-list');
    const snapshot = await db.collection('servicios').get();
    servicesList.innerHTML = snapshot.docs.map(doc => `<li>${doc.data().name} - ${doc.data().providerName}</li>`).join('');
}