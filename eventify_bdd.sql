CREATE DATABASE  EVENTIFY;
USE EVENTIFY;
CREATE TABLE Usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    primer_apellido VARCHAR(100) NOT NULL,
    segundo_apellido VARCHAR(100), -- opcional
    correo VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    password VARCHAR(255) NOT NULL, -- se recomienda usar hash (bcrypt, sha256, etc.)
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);