const admin = require('firebase-admin');

// Inicializa Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('./path/to/your/serviceAccountKey.json')) // Cambia esta ruta
    });
}

exports.handler = async (event) => {
    const { email, role } = JSON.parse(event.body); // Obtener email y rol del cuerpo de la solicitud

    try {
        const userRecord = await admin.auth().getUser ByEmail(email);
        const uid = userRecord.uid;

        const userDocRef = admin.firestore().collection('users').doc(uid);
        await userDocRef.set({ role: role }, { merge: true });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Rol '${role}' asignado a ${email}.` }),
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
