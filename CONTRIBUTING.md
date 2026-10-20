# Cómo contribuir – Grupo 4

## Ramas

| Rama   | Uso                                                                         |
| ------ | --------------------------------------------------------------------------- |
| `main` | Lo entregado en cada avance (APF2, APF3…). Solo la actualiza el coordinador |
| `dev`  | Trabajo diario. **Todos suben aquí**                                        |

```bash
git switch dev
git pull          # siempre antes de empezar
```

## Mensajes de commit

Se usa [Conventional Commits](https://www.conventionalcommits.org/es/), en inglés, cortos y descriptivos:

| Prefijo  | Cuándo                                  | Ejemplo                                                        |
| -------- | --------------------------------------- | -------------------------------------------------------------- |
| `feat:`  | Algo nuevo                              | `feat(api): add SUNAT business rules validation`               |
| `fix:`   | Corrección                              | `fix(infra): install Docker Buildx required by Compose on EC2` |
| `test:`  | Pruebas o casos de prueba               | `test: add API smoke test script`                              |
| `docs:`  | Documentación                           | `docs: document Docker usage in README`                        |
| `chore:` | Configuración o tareas de mantenimiento | `chore: set up base repository structure`                      |

## Qué nunca se sube

- `.env` (solo se sube `.env.example`, con valores de ejemplo).
- Llaves de AWS, contraseñas o tokens.
- Certificados y llaves privadas (`.pem`, `.key`, `.pfx`) y la carpeta `api/certs/`.
- Archivos de Terraform con datos de la cuenta: `*.tfstate`, `terraform.tfvars`, `backend.hcl`.
- `node_modules/` y archivos generados.

El `.gitignore` ya los bloquea. Si algo se sube por error, **avisar de inmediato**: no basta con borrarlo en otro commit, porque queda en el historial.

## Cómo levantar el proyecto

```bash
cp .env.example .env
cd api && npm install && npm run certificado && cd ..
docker compose up -d --build
bash scripts/probar-api.sh
```

Más detalles en el [README](README.md).

## Antes de subir

1. `git pull` para traer lo último.
2. Revisar `git status`: solo deben aparecer los archivos que cambiaste.
3. `git add <archivo>` (no `git add .` si no estás seguro de qué incluye).
4. `git commit -m "tipo: mensaje"` y `git push`.
