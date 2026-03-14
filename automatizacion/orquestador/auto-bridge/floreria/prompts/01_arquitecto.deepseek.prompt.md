Responde SOLO en JSON valido y nada mas. Encierra tu respuesta entre etiquetas exactas <SRFIX_JSON> y </SRFIX_JSON>.

Formato requerido:
<SRFIX_JSON>
{ ... }
</SRFIX_JSON>

PROMPT ORIGINAL:
Disena la arquitectura digital de una plantilla para el giro: floreria.

Contexto adicional opcional (si existe):
Pega aqui el resumen/manual insight de DeepSeek (o cualquier otra IA sin API).

Ejemplo:
- Priorizar flujo corto: landing -> cotizar -> folio -> portal.
- Mantener maximo 5 campos obligatorios en formulario principal.
- Incluir WhatsApp como CTA principal y estado por folio.

Reglas:
- Responde en JSON valido.
- Incluye: modulos, flujo_cliente, flujo_operativo, datos_necesarios, reglas_cotizacion, estructura_ordenes.
- Debe ser replicable para multiples negocios del mismo giro.
- Evita referencias a una marca especifica.

Formato estricto:
{
  "resumen": "...",
  "modulos": ["..."],
  "flujo_cliente": ["..."],
  "flujo_operativo": ["..."],
  "datos_necesarios": ["..."],
  "reglas_cotizacion": ["..."],
  "estructura_ordenes": ["..."]
}
