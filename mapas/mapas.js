// Importar auth y db desde Firebase para la verificación de autenticación y Firestore
import { auth, db } from "../login/config-firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js"; // Importar funciones de Firestore

// Variables globales
let sedesData = [];
let maps = {}; // Objeto para almacenar instancias de mapas Leaflet por sede
let polygons = {}; // Objeto para almacenar capas de polígonos Leaflet por sede
let markers = {}; // Objeto para almacenar capas de marcadores Leaflet por sede
let currentActiveMap = null; // Referencia al mapa Leaflet actualmente visible
let currentActiveSedeId = null; // ID de la sede actualmente activa
let currentUserRole = 'student'; // Rol por defecto del usuario

// Capas base de Leaflet
const baseLayers = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    "Satelital (Esri)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    })
};

// Icono personalizado para la ubicación del usuario
const userLocationIcon = L.divIcon({
    className: 'custom-user-location-icon',
    html: '<i class="fa-solid fa-circle-dot" style="color: #1e1b3a; font-size: 24px; text-shadow: 0 0 5px rgba(0,0,0,0.5);"></i>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});
let userLocationMarker = null;

// Función principal que se ejecuta al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Cargar los datos de las sedes
    fetch('./data/sedes.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            sedesData = data;
            renderSedeTabs();
            if (sedesData.length > 0) {
                setTimeout(() => {
                    activateSede(sedesData[0].id);
                }, 100);
            }
        })
        .catch(error => console.error('Error al cargar los datos de las sedes:', error));

    // Event Listeners para búsqueda y filtros
    document.getElementById('global-search').addEventListener('input', filterDashboard);
    document.getElementById('room-type-filter').addEventListener('change', filterDashboard);
    document.getElementById('locate-me-btn').addEventListener('click', locateUser);

    // Event listener para el botón de cerrar sesión
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault(); // Prevenir la redirección por defecto del enlace
            auth.signOut().then(() => {
                console.log("Sesión cerrada exitosamente.");
            }).catch((error) => {
                console.error("Error al cerrar sesión:", error);
                alert("Error al cerrar sesión. Inténtalo de nuevo.");
            });
        });
    }

    // Event listener para el botón de Gestionar Usuarios (solo admin)
    const manageUsersBtn = document.getElementById('manage-users-btn');
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', () => {
            const manageUsersModal = new bootstrap.Modal(document.getElementById('manageUsersModal'));
            manageUsersModal.show();
            loadUsersForManagement(); // Cargar la lista de usuarios al abrir el modal
        });
    }

    // Event listener para asignar rol en el modal de gestión de usuarios
    const assignRoleBtn = document.getElementById('assign-role-btn');
    if (assignRoleBtn) {
        assignRoleBtn.addEventListener('click', assignRoleToUser);
    }
});

// Verificar estado de autenticación y cargar rol del usuario
onAuthStateChanged(auth, async (user) => {
    const userEmailSpan = document.getElementById('user-email');
    const userDisplayNameSpan = document.getElementById('user-display-name');
    const roleIndicator = document.getElementById('role-indicator');
    const adminControls = document.getElementById('admin-controls');

    if (!user) {
        // Si no hay usuario logueado, redirigir a la página de login
        window.location.href = "../login/login.html";
    } else {
        // Actualizar la UI con el email del usuario
        if (userEmailSpan) {
            userEmailSpan.textContent = user.email;
        }
        if (userDisplayNameSpan) {
            userDisplayNameSpan.textContent = user.displayName || user.email.split('@')[0]; // Mostrar nombre o parte del email
        }

        // Obtener el rol del usuario desde Firestore
        const userDocRef = doc(db, "users", user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                currentUserRole = userDocSnap.data().role || 'student'; // Asignar rol, por defecto 'student'
            } else {
                // Si el documento del usuario no existe, crearlo con rol 'student'
                await setDoc(userDocRef, { email: user.email, role: 'student' });
                currentUserRole = 'student';
            }
        } catch (error) {
            console.error("Error al obtener o establecer el rol del usuario:", error);
            currentUserRole = 'student'; // Fallback en caso de error
        }

        // Actualizar el indicador de rol en la UI
        if (roleIndicator) {
            roleIndicator.textContent = currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1); // Capitalizar
            roleIndicator.className = `role-badge me-2 badge-${currentUserRole}`; // Añadir clase para estilo
        }

        // Mostrar/ocultar elementos de administración
        if (adminControls) {
            if (currentUserRole === 'admin') {
                adminControls.style.display = 'block';
            } else {
                adminControls.style.display = 'none';
            }
        }
    }
});

// Función para renderizar las pestañas de las sedes
function renderSedeTabs() {
    const sedeTabsContainer = document.getElementById('sedeTabs');
    const sedeTabContentContainer = document.getElementById('sedeTabContent');
    sedeTabsContainer.innerHTML = '';
    sedeTabContentContainer.innerHTML = '';

    sedesData.forEach((sede, index) => {
        const isActive = index === 0 ? 'active' : '';
        const isSelected = index === 0 ? 'true' : 'false';

        const tabItem = document.createElement('li');
        tabItem.classList.add('nav-item');
        tabItem.setAttribute('role', 'presentation');
        tabItem.innerHTML = `
            <button class="nav-link ${isActive}" id="${sede.id}-tab" data-bs-toggle="tab"
                    data-bs-target="#${sede.id}-pane" type="button" role="tab"
                    aria-controls="${sede.id}-pane" aria-selected="${isSelected}">
                ${sede.nombre}
            </button>
        `;
        sedeTabsContainer.appendChild(tabItem);

        const tabPane = document.createElement('div');
        tabPane.classList.add('tab-pane', 'fade', isActive ? 'show' : '');
        tabPane.setAttribute('id', `${sede.id}-pane`);
        tabPane.setAttribute('role', 'tabpanel');
        tabPane.setAttribute('aria-labelledby', `${sede.id}-tab`);
        tabPane.setAttribute('tabindex', '0');
        tabPane.innerHTML = `<div id="map-${sede.id}" class="map-container"></div>`;
        sedeTabContentContainer.appendChild(tabPane);

        tabItem.querySelector('button').addEventListener('shown.bs.tab', event => {
            const targetSedeId = event.target.id.replace('-tab', '');
            activateSede(targetSedeId);
        });
    });
}

// Función para activar una sede y mostrar su mapa y detalles
function activateSede(sedeId) {
    const sede = sedesData.find(s => s.id === sedeId);

    if (!sede) {
        console.error(`Sede con ID ${sedeId} no encontrada.`);
        return;
    }

    currentActiveSedeId = sedeId; // Actualizar la sede activa

    if (currentActiveMap) {
        currentActiveMap.invalidateSize();
    }

    if (!maps[sedeId]) {
        maps[sedeId] = L.map(`map-${sedeId}`).setView([sede.coordenadas_centro.lat, sede.coordenadas_centro.lng], sede.zoom);

        // Añadir capas base y control de capas
        baseLayers["OpenStreetMap"].addTo(maps[sedeId]);
        L.control.layers(baseLayers).addTo(maps[sedeId]);
        
        drawBlocksOnMap(sede);
        drawMarkersOnMap(sede);
    } else {
        maps[sedeId].setView([sede.coordenadas_centro.lat, sede.coordenadas_centro.lng], sede.zoom);
        maps[sedeId].invalidateSize();
    }

    currentActiveMap = maps[sedeId];

    renderSedeDashboard(sede);
    filterDashboard(); // Aplicar filtros y búsqueda al cambiar de sede
}

// Función para dibujar los polígonos de los bloques en el mapa
function drawBlocksOnMap(sede) {
    if (!polygons[sede.id]) {
        polygons[sede.id] = [];
    }

    sede.bloques.forEach(bloque => {
        const blockPolygon = L.polygon(bloque.poligono, {
            color: '#1e1b3a',
            weight: 3,
            opacity: 0.8,
            fillColor: '#FFC107',
            fillOpacity: 0.35,
            blockId: bloque.id // Almacenar el ID del bloque en las opciones del polígono
        }).addTo(maps[sede.id]);

        blockPolygon.bindPopup(`
            <div style="font-family: 'Inter', sans-serif; text-align: center;">
                <h5 style="color: #1e1b3a; margin-bottom: 5px;">${bloque.nombre}</h5>
                <p style="font-size: 0.9em; color: #555;">Haz clic en el dashboard para ver detalles de pisos y salones.</p>
            </div>
        `);

        blockPolygon.on('click', () => {
            const blockElement = document.querySelector(`.block-item[data-block-id="${bloque.id}"]`);
            if (blockElement) {
                // Simular clic en el dashboard para activar y expandir
                blockElement.click();
            }
        });

        polygons[sede.id].push(blockPolygon);
    });
}

// Función para dibujar marcadores en el mapa
function drawMarkersOnMap(sede) {
    if (!markers[sede.id]) {
        markers[sede.id] = [];
    }

    if (sede.marcadores && sede.marcadores.length > 0) {
        sede.marcadores.forEach(markerData => {
            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<i class="${markerData.icono}" style="color: #1e1b3a; font-size: 30px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);"></i>`,
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -25]
            });

            const marker = L.marker([markerData.coordenadas.lat, markerData.coordenadas.lng], { icon: customIcon })
                .addTo(maps[sede.id]);

            if (markerData.popup_html) {
                marker.bindPopup(markerData.popup_html);
            }
            markers[sede.id].push(marker);
        });
    }
}

// Función para renderizar el dashboard lateral
function renderSedeDashboard(sede) {
    const sedeDetailsContainer = document.getElementById('sede-details');
    sedeDetailsContainer.innerHTML = ''; // Limpiar contenido anterior

    if (sede.bloques.length === 0) {
        sedeDetailsContainer.innerHTML = `<p class="text-center text-muted no-details-msg"><i class="fa-solid fa-building me-2"></i>No hay bloques definidos para ${sede.nombre}.</p>`;
        return;
    }

    sede.bloques.forEach(bloque => {
        const blockDiv = document.createElement('div');
        blockDiv.classList.add('block-item', 'mb-3');
        blockDiv.innerHTML = `<strong>${bloque.nombre}</strong>`;
        blockDiv.setAttribute('data-block-id', bloque.id);

        const floorsList = document.createElement('ul');
        floorsList.classList.add('list-unstyled', 'ms-3', 'mt-3');
        floorsList.style.display = 'none';

        bloque.pisos.forEach(piso => {
            const floorLi = document.createElement('li');
            floorLi.classList.add('floor-item');
            floorLi.innerHTML = `Piso ${piso.numero}`;
            floorLi.setAttribute('data-floor-num', piso.numero);

            const roomsList = document.createElement('ul');
            roomsList.classList.add('list-unstyled', 'ms-3', 'mt-3');
            roomsList.style.display = 'none';

            piso.salones.forEach(salon => {
                const roomLi = document.createElement('li');
                roomLi.classList.add('room-item');
                roomLi.innerHTML = `<span><i class="fa-solid ${getRoomIcon(salon.tipo)} me-2"></i>${salon.nombre}</span>`;
                roomLi.setAttribute('data-salon-id', salon.id);
                roomLi.setAttribute('data-salon-type', salon.tipo); // Para el filtro

                // Detalles del salón para el modal
                roomLi.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showRoomDetailsModal(salon, bloque, piso);
                });

                roomsList.appendChild(roomLi);
            });
            floorLi.appendChild(roomsList);

            floorLi.addEventListener('click', () => {
                // Remover 'active' de todos los pisos y salones
                document.querySelectorAll('.floor-item.active, .room-item.active').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.floor-item ul').forEach(el => el.style.display = 'none');

                // Activar el piso clicado y mostrar sus salones
                roomsList.style.display = 'block';
                floorLi.classList.add('active');
            });

            floorsList.appendChild(floorLi);
        });
        blockDiv.appendChild(floorsList);

        blockDiv.addEventListener('click', () => {
            // Remover 'active' de todos los bloques, pisos y salones
            document.querySelectorAll('.block-item.active, .floor-item.active, .room-item.active').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.block-item ul, .floor-item ul').forEach(el => el.style.display = 'none');

            // Activar el bloque clicado y mostrar sus pisos
            floorsList.style.display = 'block';
            blockDiv.classList.add('active');

            // Centrar el mapa en el polígono del bloque al hacer clic
            const targetPolygon = polygons[sede.id].find(p => p.options.blockId === bloque.id);
            if (targetPolygon && currentActiveMap) {
                currentActiveMap.fitBounds(targetPolygon.getBounds());
                // Resaltar polígono
                targetPolygon.setStyle({ fillColor: '#b3cbea', fillOpacity: 0.6 });
                // Restaurar estilo después de un tiempo
                setTimeout(() => {
                    targetPolygon.setStyle({ fillColor: '#FFC107', fillOpacity: 0.35 });
                }, 1500);
            } else if (currentActiveMap) {
                currentActiveMap.setView([sede.coordenadas_centro.lat, sede.coordenadas_centro.lng], sede.zoom);
            }
        });

        sedeDetailsContainer.appendChild(blockDiv);
    });
}

// Función para filtrar el dashboard (búsqueda y tipo de salón)
function filterDashboard() {
    const searchTerm = document.getElementById('global-search').value.toLowerCase();
    const roomTypeFilter = document.getElementById('room-type-filter').value;
    const sede = sedesData.find(s => s.id === currentActiveSedeId);

    if (!sede) return;

    // Ocultar todos los elementos primero
    document.querySelectorAll('#sede-details .block-item').forEach(blockDiv => {
        blockDiv.style.display = 'none';
        blockDiv.classList.remove('active');
        blockDiv.querySelector('ul').style.display = 'none'; // Ocultar pisos
        blockDiv.querySelectorAll('.floor-item').forEach(floorLi => {
            floorLi.style.display = 'none';
            floorLi.classList.remove('active');
            floorLi.querySelector('ul').style.display = 'none'; // Ocultar salones
            floorLi.querySelectorAll('.room-item').forEach(roomLi => {
                roomLi.style.display = 'none';
                roomLi.classList.remove('active');
            });
        });
    });

    sede.bloques.forEach(bloque => {
        let blockMatches = false;
        const blockDiv = document.querySelector(`.block-item[data-block-id="${bloque.id}"]`);
        if (!blockDiv) return; // Si el bloque no está renderizado, saltar

        bloque.pisos.forEach(piso => {
            let floorMatches = false;
            const floorLi = blockDiv.querySelector(`.floor-item[data-floor-num="${piso.numero}"]`);
            if (!floorLi) return;

            piso.salones.forEach(salon => {
                const roomLi = floorLi.querySelector(`.room-item[data-salon-id="${salon.id}"]`);
                if (!roomLi) return;

                const nameMatches = salon.nombre.toLowerCase().includes(searchTerm);
                const typeMatches = roomTypeFilter === '' || salon.tipo === roomTypeFilter;

                if (nameMatches && typeMatches) {
                    roomLi.style.display = 'list-item'; // Mostrar salón
                    floorLi.style.display = 'list-item'; // Mostrar piso
                    floorLi.querySelector('ul').style.display = 'block'; // Expandir salones
                    blockDiv.style.display = 'block'; // Mostrar bloque
                    blockDiv.querySelector('ul').style.display = 'block'; // Expandir pisos
                    blockMatches = true;
                    floorMatches = true;
                } else {
                    roomLi.style.display = 'none'; // Ocultar salón
                }
            });

            if (!floorMatches) {
                floorLi.style.display = 'none'; // Ocultar piso si ningún salón coincide
            }
        });

        if (!blockMatches) {
            blockDiv.style.display = 'none'; // Ocultar bloque si ningún piso/salón coincide
        } else {
            blockDiv.style.display = 'block'; // Asegurarse de que el bloque se muestre si hay coincidencias
        }
    });

    // Mostrar mensaje si no hay resultados
    const visibleItems = document.querySelectorAll('#sede-details .block-item[style*="display: block"]').length;
    const noDetailsMsg = document.querySelector('#sede-details .no-details-msg');
    if (visibleItems === 0 && (searchTerm !== '' || roomTypeFilter !== '')) {
        if (!noDetailsMsg) {
            const msg = document.createElement('p');
            msg.classList.add('text-center', 'text-muted', 'no-details-msg');
            msg.innerHTML = '<i class="fa-solid fa-exclamation-circle me-2"></i>No se encontraron resultados.';
            document.getElementById('sede-details').appendChild(msg);
        } else {
            noDetailsMsg.innerHTML = '<i class="fa-solid fa-exclamation-circle me-2"></i>No se encontraron resultados.';
            noDetailsMsg.style.display = 'block';
        }
    } else if (noDetailsMsg) {
        noDetailsMsg.style.display = 'none';
    }
}


// Función para mostrar el modal de detalles del salón
function showRoomDetailsModal(salon, bloque, piso) {
    const modalTitle = document.getElementById('roomDetailsModalLabel');
    const modalBody = document.getElementById('roomDetailsModalBody');

    modalTitle.textContent = `Detalles de ${salon.nombre}`;
    
    let equipmentHtml = '<ul>';
    if (salon.equipos && salon.equipos.length > 0) {
        salon.equipos.forEach(eq => {
            equipmentHtml += `<li><i class="fa-solid fa-check-circle me-2 text-success"></i>${eq}</li>`;
        });
    } else {
        equipmentHtml += `<li><i class="fa-solid fa-info-circle me-2 text-info"></i>No hay equipos específicos listados.</li>`;
    }
    equipmentHtml += '</ul>';

    modalBody.innerHTML = `
        <p><strong>Ubicación:</strong> ${bloque.nombre}, Piso ${piso.numero}</p>
        <p><strong>Tipo:</strong> ${salon.tipo}</p>
        <p><strong>Capacidad:</strong> ${salon.capacidad} personas</p>
        <h6>Equipamiento:</h6>
        ${equipmentHtml}
        <p class="text-muted mt-3"><em>Más detalles o funcionalidades (ej. reserva) podrían añadirse aquí.</em></p>
    `;

    const roomDetailsModal = new bootstrap.Modal(document.getElementById('roomDetailsModal'));
    roomDetailsModal.show();
}

// Función para obtener el icono de Font Awesome según el tipo de salón
function getRoomIcon(tipo) {
    switch (tipo) {
        case 'Clase':
            return 'fa-chalkboard';
        case 'Laboratorio':
            return 'fa-flask';
        case 'Auditorio':
            return 'fa-microphone';
        case 'Biblioteca':
            return 'fa-book';
        case 'Administrativo':
            return 'fa-briefcase';
        case 'Conferencias':
            return 'fa-users';
        default:
            return 'fa-door-open'; // Icono por defecto
    }
}

// Función para localizar al usuario
function locateUser() {
    if (!currentActiveMap) {
        alert('Por favor, selecciona una sede primero.');
        return;
    }

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // Remover marcador anterior si existe
                if (userLocationMarker) {
                    currentActiveMap.removeLayer(userLocationMarker);
                }

                // Añadir nuevo marcador de ubicación del usuario
                userLocationMarker = L.marker([lat, lng], { icon: userLocationIcon }).addTo(currentActiveMap)
                    .bindPopup("¡Estás aquí!").openPopup();

                // Centrar el mapa en la ubicación del usuario
                currentActiveMap.setView([lat, lng], 18); // Zoom más cercano
            },
            (error) => {
                console.error("Error al obtener la ubicación:", error);
                let errorMessage = "No se pudo obtener tu ubicación.";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Permiso de geolocalización denegado. Por favor, habilítalo en la configuración de tu navegador.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Información de ubicación no disponible.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "La solicitud para obtener la ubicación ha caducado.";
                        break;
                }
                alert(errorMessage);
            },
            {
                enableHighAccuracy: true, // Intentar obtener la ubicación más precisa
                timeout: 10000, // Tiempo máximo para obtener la ubicación (10 segundos)
                maximumAge: 0 // No usar una ubicación en caché
            }
        );
    } else {
        alert("Tu navegador no soporta la geolocalización.");
    }
}

// --- Funciones de Gestión de Usuarios (Solo Admin) ---

// Función para cargar la lista de usuarios en el modal de gestión
async function loadUsersForManagement() {
    const userListElement = document.getElementById('user-list');
    userListElement.innerHTML = ''; // Limpiar lista anterior

    try {
        const usersCollection = collection(db, "users");
        const querySnapshot = await getDocs(usersCollection);

        if (querySnapshot.empty) {
            userListElement.innerHTML = '<li class="list-group-item text-center text-muted">No hay usuarios registrados en Firestore.</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            const userUid = doc.id;
            const userEmail = userData.email || 'N/A';
            const userRole = userData.role || 'student';

            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item');
            listItem.innerHTML = `
                <span>${userEmail}</span>
                <span class="badge rounded-pill badge-${userRole}">${userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
            `;
            userListElement.appendChild(listItem);
        });

    } catch (error) {
        console.error("Error al cargar usuarios para gestión:", error);
        userListElement.innerHTML = '<li class="list-group-item text-center text-danger">Error al cargar usuarios.</li>';
    }
}

// Función para asignar un rol a un usuario desde el modal
async function assignRoleToUser() {
    const userEmailInput = document.getElementById('user-email-input');
    const userRoleSelect = document.getElementById('user-role-select');
    const roleAssignmentMessage = document.getElementById('role-assignment-message');

    const emailToAssign = userEmailInput.value.trim();
    const roleToAssign = userRoleSelect.value;

    roleAssignmentMessage.textContent = ''; // Limpiar mensaje anterior
    roleAssignmentMessage.className = 'mt-3'; // Resetear clases

    if (!emailToAssign) {
        roleAssignmentMessage.textContent = 'Por favor, ingresa un correo electrónico.';
        roleAssignmentMessage.classList.add('text-danger');
        return;
    }

    try {
        // Primero, obtener el UID del usuario por su email (esto requiere Firebase Admin SDK en un backend)
        // Para este ejemplo de frontend, asumiremos que el email ya está en Firestore y buscaremos por email.
        // En un entorno de producción, esta operación de búsqueda por email y asignación de rol
        // debería hacerse en un backend seguro (Firebase Functions, Node.js, etc.)
        // para evitar que usuarios maliciosos manipulen roles.

        // Simulación de búsqueda de UID por email en el frontend (NO SEGURO PARA PRODUCCIÓN)
        let targetUserUid = null;
        const usersCollection = collection(db, "users");
        const querySnapshot = await getDocs(usersCollection);
        querySnapshot.forEach((doc) => {
            if (doc.data().email === emailToAssign) {
                targetUserUid = doc.id;
            }
        });

        if (!targetUserUid) {
            roleAssignmentMessage.textContent = `Usuario con correo ${emailToAssign} no encontrado en Firestore.`;
            roleAssignmentMessage.classList.add('text-danger');
            return;
        }

        // Asignar el rol en Firestore
        const userDocRef = doc(db, "users", targetUserUid);
        await setDoc(userDocRef, { role: roleToAssign }, { merge: true });

        roleAssignmentMessage.textContent = `Rol '${roleToAssign}' asignado exitosamente a ${emailToAssign}.`;
        roleAssignmentMessage.classList.add('text-success');

        userEmailInput.value = ''; // Limpiar input
        loadUsersForManagement(); // Recargar la lista de usuarios

    } catch (error) {
        console.error("Error al asignar rol:", error);
        roleAssignmentMessage.textContent = `Error al asignar rol: ${error.message}`;
        roleAssignmentMessage.classList.add('text-danger');
    }
}
