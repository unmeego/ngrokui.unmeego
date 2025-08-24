# ngrok Control

Una aplicación de escritorio moderna para gestionar múltiples túneles ngrok de forma visual e intuitiva.

![ngrok Control](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/Electron-27.0.0-47848F?logo=electron)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Características

- 🚀 **Múltiples túneles simultáneos** - Gestiona varios túneles ngrok al mismo tiempo
- 🎨 **Interfaz estilo móvil** - Diseño limpio y minimalista en una columna
- ⚙️ **Configuración integrada** - Guarda y configura tu authtoken desde la app
- 🔍 **Verificación automática** - Detecta si ngrok está instalado y ofrece instalación
- 📊 **Logs en tiempo real** - Ve los logs de cada túnel por separado
- 🌐 **Dominios estáticos** - Soporte para dominios personalizados (cuenta premium)
- 📋 **Copiar/Abrir URLs** - Acceso rápido a las URLs públicas generadas
- 🔧 **Inspector integrado** - Acceso directo al inspector web de ngrok

## 🖼️ Capturas de pantalla

### Pantalla principal
- Lista de túneles con estado en tiempo real
- Botones Start/Stop individuales por túnel
- URLs públicas con botones de copiar/abrir

### Panel de configuración
- Campo para authtoken de ngrok
- Verificación de instalación de ngrok
- Instalación automática via Homebrew (macOS)

## 🚀 Instalación

### Prerrequisitos
- Node.js 16+ 
- npm o yarn

### Clonar e instalar
```bash
git clone https://github.com/tu-usuario/ngrok-control.git
cd ngrok-control
npm install
```

### Ejecutar en desarrollo
```bash
npm run dev
```

### Construir para producción
```bash
npm run build
```

## 📋 Uso

### 1. Configuración inicial
1. Abre la aplicación
2. Ve a Configuración (⚙️)
3. Ingresa tu authtoken de ngrok
4. Verifica que ngrok esté instalado

### 2. Crear un túnel
1. Haz clic en "+ Nuevo túnel"
2. Completa los campos:
   - **Nombre**: Identificador del túnel
   - **Protocolo**: HTTP o TCP
   - **Puerto**: Puerto local a exponer
   - **Static Domain** (opcional): Para cuentas premium
3. Haz clic en "Crear"

### 3. Gestionar túneles
- **Start**: Inicia el túnel y genera URL pública
- **Stop**: Detiene el túnel específico
- **Copiar**: Copia la URL pública al portapapeles
- **Abrir**: Abre la URL en el navegador
- **Inspector**: Accede al inspector web de ngrok (puerto 4040)

## ⚙️ Configuración de ngrok

La aplicación utiliza el archivo de configuración estándar de ngrok:
- **macOS**: `~/Library/Application Support/ngrok/ngrok.yml`
- **Windows**: `%APPDATA%/ngrok/ngrok.yml`
- **Linux**: `~/.config/ngrok/ngrok.yml`

### Ejemplo de configuración generada:
```yaml
version: '2'
authtoken: tu_token_aqui
tunnels:
  mi-app:
    proto: http
    addr: 3000
    hostname: mi-dominio.ngrok.io  # Solo con static domain
```

## 🔧 Desarrollo

### Estructura del proyecto
```
ngrok-control/
├── main.js          # Proceso principal de Electron
├── preload.js       # Bridge seguro IPC
├── renderer.js      # Lógica de la interfaz
├── index.html       # Estructura HTML
├── styles.css       # Estilos CSS
└── package.json     # Configuración y dependencias
```

### Scripts disponibles
- `npm run dev` - Ejecutar en desarrollo
- `npm run start` - Ejecutar aplicación
- `npm run build` - Construir para distribución

### Tecnologías utilizadas
- **Electron** - Framework de aplicaciones de escritorio
- **Node.js** - Runtime de JavaScript
- **HTML/CSS/JS** - Interfaz nativa sin frameworks
- **js-yaml** - Manejo de archivos de configuración
- **electron-store** - Persistencia de datos

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📝 Roadmap

- [ ] Soporte para configuraciones avanzadas de túneles
- [ ] Exportar/importar configuraciones
- [ ] Temas personalizables (claro/oscuro)
- [ ] Notificaciones del sistema
- [ ] Estadísticas de uso de túneles
- [ ] Soporte para múltiples cuentas ngrok

## 🐛 Reportar problemas

Si encuentras algún bug o tienes una sugerencia:
1. Revisa los [issues existentes](https://github.com/tu-usuario/ngrok-control/issues)
2. Crea un nuevo issue con detalles del problema
3. Incluye logs y capturas de pantalla si es posible

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- [ngrok](https://ngrok.com/) por la excelente herramienta de túneles
- [Electron](https://electronjs.org/) por el framework de aplicaciones de escritorio
- Comunidad open source por las librerías utilizadas

---

⭐ Si te gusta este proyecto, ¡dale una estrella en GitHub!