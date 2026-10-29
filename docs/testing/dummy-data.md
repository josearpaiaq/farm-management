# Dummy Data for Manual Testing

Test fixtures to exercise the web MVP end to end. The CSV uses the Spanish
synonyms and Spanish-locale formats the import parser accepts (semicolons,
`DD/MM/YYYY` dates, decimal comma), which is what a real Excel export from the
field looks like.

## 1. Prerequisites (create in the UI first)

The import resolves farms and breeds **by name**, so create these before
uploading — it also exercises the Fincas and Razas pages:

**Fincas** (Fincas → Nueva finca)

| Nombre       | Ubicación (opcional) |
| ------------ | -------------------- |
| La Esperanza | Vía El Vigía, km 12  |
| El Roble     | Sector Caño Seco     |

**Razas** (Razas → Nueva raza)

| Especie | Nombre   |
| ------- | -------- |
| Bovino  | Brahman  |
| Bovino  | Holstein |
| Caprino | Alpina   |

## 2. CSV import (`dummy-animals.csv`)

Importar → select the file → **Validar (sin guardar)**.

- **Rows 1–20 are valid**: 13 cattle, 3 sheep, 2 goats, 1 horse, 1 pig,
  spread across both farms. They mix Spanish/English codes and synonyms
  (`oveja`, `cabra`, `h`, `cattle`), missing optional fields (no breed, no
  birth date, no weight), and decimal commas.
- **The last 7 rows must come back as errors**, one per validation rule:

  | Tag     | Expected error                            |
  | ------- | ----------------------------------------- |
  | V-014   | Unknown farm "La Ceiba"                   |
  | L-001   | Unknown species "llama"                   |
  | V-015   | Birth date in the future                  |
  | V-016   | Weight must be positive                   |
  | (empty) | Missing tag                               |
  | V-001   | Duplicate tag in file                     |
  | V-017   | Breed species mismatch (Alpina on cattle) |

Then **Importar filas válidas**: 20 imported, 7 skipped/errored. Download the
report from the history list. Upload the **same file again** and commit to
verify idempotency: the 20 existing tags are skipped, nothing duplicates.

After the import, the dashboard should show 20 active animals (13 bovino,
3 ovino, 2 caprino, 1 equino, 1 porcino), and the animals list can be
filtered by farm, species, sex, and status.

## 3. Per-animal records (enter manually on an animal's detail page)

Weight series for **V-001** (Pesos tab) — enough points to eyeball growth:

| Peso (kg) | Fecha      |
| --------- | ---------- |
| 402,0     | 01/07/2026 |
| 396,5     | 15/06/2026 |

Health events for **V-001** (Salud tab):

| Tipo        | Fecha      | Producto     | Retiro hasta                    |
| ----------- | ---------- | ------------ | ------------------------------- |
| Vacunación  | 10/06/2026 | Aftosa oleosa| —                               |
| Tratamiento | 05/07/2026 | Oxitetraciclina | a future date → warning color |

Note for **V-001** (Notas tab):

> Compró en subasta de Santa Bárbara. Revisar preñez en agosto.

## 4. Other quick checks

- Edit V-004 and set it as **Padre** of a new animal (same species, male).
- Change an animal's estado to **Vendido** → dashboard counts move.
- Try deleting **La Esperanza** (Fincas) → must be rejected while it has
  animals (409).
- Create a breed with an existing name for the same species → conflict error.
