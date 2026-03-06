# Persistir image_file_name en la tabla Product

El frontend envía `imageFileName` en el body al **crear** y **actualizar** producto (camelCase). Si en la tabla no se guarda, revisar en la API .NET:

## 1. Entidad Product (mapeo a la tabla)

- Debe tener una propiedad que se guarde en la columna de la BD, por ejemplo:
  - `public string? ImageFileName { get; set; }`
- La columna en PostgreSQL debe existir. Si usas snake_case:
  - Nombre de columna: `image_file_name`
  - En el DbContext: `entity.Property(e => e.ImageFileName).HasColumnName("image_file_name");`

## 2. CreateProductCommand / Handler

- El command ya tiene `ImageFileName`.
- En el **handler**, al crear la entidad Product, asignar el valor del command:
  - `product.ImageFileName = request.ImageFileName;` (o el nombre de tu propiedad)
- Luego guardar con `_context.Products.Add(product)` y `SaveChangesAsync()`.

## 3. UpdateProductCommand / Handler

- El command (o DTO de actualización) debe tener `ImageFileName` (opcional).
- En el **handler**, al cargar el producto y actualizarlo, asignar:
  - `product.ImageFileName = request.ImageFileName;` (si viene en el request)
- Si quieres permitir “quitar” la imagen, cuando el front envíe `imageFileName: null` o vacío, hacer `product.ImageFileName = null;`.

## 4. JSON (camelCase vs PascalCase)

- El front envía `imageFileName` (camelCase). ASP.NET Core suele mapear por defecto a la propiedad C# `ImageFileName`. Si tu API usa otro contrato, asegúrate de que el binding reciba ese campo (p. ej. `[FromBody]` con el mismo nombre o configuración de serialización).

## Comprobar en el frontend

En DevTools → Red, al guardar producto:
- **POST** `/products/products` (crear): el body debe incluir `"imageFileName": "nombre-del-archivo-en-s3"`.
- **PUT** `/products/products/{id}` (editar): igual si cambiaste la imagen.

Si el body lleva `imageFileName` y en la BD no se guarda, el fallo está en el handler o en el mapeo de la entidad a la columna `image_file_name`.
