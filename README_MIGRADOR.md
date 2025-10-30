# 🧰 Migrador de Base de Datos – Tienda Natural

## 📘 Descripción
El **migrador** actualiza la base de datos sin perder datos existentes.

### Qué hace
- Crea `category_coefficients` si no existe.
- Convierte `stock` y `min_stock` a tipo REAL.
- Crea índices y claves foráneas.
- Inserta coeficientes base por categoría.

## ⚙️ Pasos para ejecutar
1. **Backup** de la base de datos:
   - Windows: `copy backend\database.sqlite backend\database_backup.sqlite`
   - Linux/Mac: `cp backend/database.sqlite backend/database_backup.sqlite`
2. **Ejecutar migrador**:
   ```bash
   node src/migrador.js
   ```
3. **Ver resultado esperado** en consola.

## 📦 Rollback
Si algo falla, restaurar el backup:
- Windows: `copy /Y backend\database_backup.sqlite backend\database.sqlite`
- Linux/Mac: `cp -f backend/database_backup.sqlite backend/database.sqlite`

## 💬 Autor
👨‍💻 Oscar Alejandro Ortiz  
🌐 github.com/OAODesarrollador  
📍 Formosa, Argentina
