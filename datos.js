// Datos del simulador. Nada de esto sale del navegador de quien lo usa.

/**
 * Lo que la IA de Foodzy lee de la factura de ejemplo (img/factura-ejemplo.jpg):
 * los 40 renglones, con el emoji del producto, el precio de cada renglón (con
 * IVA), dónde conviene guardarlo y cuántos días dura sin abrir en cada lugar
 * (la misma tabla de vida útil que usa la app para estimar). Las facturas no
 * traen fecha de vencimiento, así que todas las fechas son estimadas.
 *
 * dias: [nevera, congelador, alacena]; null = no vence.
 */
const FACTURA_EJEMPLO = {
  tienda: 'Supermercado El Buen Sabor',
  numero: '0004587',
  productos: [
    ['Yuca', 'Verduras', '🍠', 2, 'kg', 5000, 'alacena', [7, 180, 4]],
    ['Papa pastusa', 'Verduras', '🥔', 3, 'kg', 6000, 'alacena', [21, 240, 30]],
    ['Queso costeño', 'Lácteos', '🧀', 1, 'kg', 12000, 'nevera', [7, 60, 1]],
    ['Harina de trigo', 'Granos y harinas', '🌾', 1, 'kg', 3200, 'alacena', [365, 365, 365]],
    ['Harina de maíz', 'Granos y harinas', '🌽', 1, 'kg', 2800, 'alacena', [365, 365, 365]],
    ['Salchicha', 'Carnes frías', '🌭', 1, 'kg', 8500, 'nevera', [30, 60, 1]],
    ['Salchichón', 'Carnes frías', '🍖', 0.5, 'kg', 5000, 'nevera', [30, 60, 2]],
    ['Manzana', 'Frutas', '🍎', 2, 'kg', 9000, 'nevera', [30, 240, 10]],
    ['Pera', 'Frutas', '🍐', 2, 'kg', 8000, 'nevera', [30, 240, 10]],
    ['Yogur', 'Lácteos', '🥣', 1, 'u', 2100, 'nevera', [21, 60, 1]],
    ['Queso crema', 'Lácteos', '🧀', 1, 'u', 6300, 'nevera', [30, 90, 1]],
    ['Crema de leche', 'Lácteos', '🥛', 1, 'u', 5250, 'nevera', [10, 90, 1]],
    ['Color', 'Especias', '🧂', 0.1, 'kg', 250, 'alacena', null],
    ['Comino', 'Especias', '🧂', 0.1, 'kg', 200, 'alacena', null],
    ['Trifogón', 'Especias', '🧂', 0.1, 'kg', 250, 'alacena', null],
    ['Ajo', 'Verduras', '🧄', 0.5, 'kg', 1500, 'alacena', [90, 180, 60]],
    ['Tomate', 'Verduras', '🍅', 1, 'kg', 2500, 'nevera', [10, 180, 6]],
    ['Cebolla', 'Verduras', '🧅', 1, 'kg', 2000, 'alacena', [30, 180, 45]],
    ['Ají', 'Verduras', '🌶️', 0.5, 'kg', 1250, 'nevera', [7, 120, 3]],
    ['Zanahoria', 'Verduras', '🥕', 1, 'kg', 2000, 'nevera', [21, 240, 7]],
    ['Lechuga', 'Verduras', '🥬', 1, 'u', 1500, 'nevera', [5, 1, 1]],
    ['Brócoli', 'Verduras', '🥦', 1, 'u', 3000, 'nevera', [7, 240, 2]],
    ['Habichuela', 'Verduras', '🫛', 1, 'kg', 3000, 'nevera', [7, 240, 2]],
    ['Arveja verde', 'Verduras', '🫛', 1, 'kg', 3500, 'nevera', [5, 240, 2]],
    ['Aguacate', 'Frutas', '🥑', 1, 'kg', 4000, 'alacena', [6, 120, 4]],
    ['Banano', 'Frutas', '🍌', 2, 'kg', 3000, 'alacena', [7, 90, 5]],
    ['Fresa', 'Frutas', '🍓', 1, 'kg', 5000, 'nevera', [4, 240, 1]],
    ['Mora', 'Frutas', '🫐', 1, 'kg', 6000, 'nevera', [4, 240, 1]],
    ['Guayaba', 'Frutas', '🍈', 1, 'kg', 4000, 'nevera', [7, 240, 3]],
    ['Tomate de árbol', 'Frutas', '🍅', 1, 'kg', 3500, 'nevera', [14, 240, 6]],
    ['Lulo', 'Frutas', '🍊', 1, 'kg', 3500, 'nevera', [7, 240, 4]],
    ['Cereal para jugos', 'Cereales', '🥣', 1, 'u', 8400, 'alacena', [180, 180, 180]],
    ['Azúcar', 'Endulzantes', '🍬', 1, 'kg', 2500, 'alacena', null],
    ['Miel', 'Endulzantes', '🍯', 1, 'u', 9000, 'alacena', null],
    ['Café', 'Bebidas', '☕', 1, 'u', 8400, 'alacena', [180, 180, 180]],
    ['Leche líquida', 'Lácteos', '🥛', 1, 'u', 3150, 'nevera', [5, 60, 1]],
    ['Huevos', 'Huevos', '🥚', 1, 'u', 12000, 'nevera', [30, 1, 21]],
    ['Pan tajado', 'Panadería', '🍞', 1, 'u', 3675, 'alacena', [10, 90, 7]],
    ['Pasta', 'Granos y harinas', '🍝', 1, 'u', 3000, 'alacena', [365, 365, 365]],
    ['Aceite vegetal', 'Aceites', '🫒', 1, 'u', 6000, 'alacena', [365, 365, 365]],
  ],
};

/**
 * La despensa con la que arranca la demo, para que se vea viva antes del
 * primer escaneo: hay algo vencido, algo que vence hoy y algo que no vence.
 * dias: cuántos días faltan desde el día en que se abre la demo.
 */
const DESPENSA_INICIAL = [
  ['Tomates perita', 'Verduras', '🍅', 1, 'kg', 0, 'nevera', 'estimada', 4800],
  ['Leche deslactosada', 'Lácteos', '🥛', 1, 'L', 1, 'nevera', 'leida', 4200],
  ['Pan de molde', 'Panadería', '🍞', 1, 'u', -1, 'alacena', 'estimada', 6900],
  ['Yogur griego', 'Lácteos', '🥣', 1, 'u', 3, 'nevera', 'leida', 5600],
  ['Aguacate hass', 'Frutas', '🥑', 2, 'u', 2, 'alacena', 'estimada', 5000],
  ['Pechuga de pollo', 'Carnes', '🍗', 0.5, 'kg', 90, 'congelador', 'manual', 9800],
  ['Arroz', 'Granos y harinas', '🍚', 2, 'kg', 300, 'alacena', 'leida', 8400],
  ['Sal', 'Especias', '🧂', 1, 'kg', null, 'alacena', 'manual', 1500],
];

/** La lista de compras de la demo. Al guardar la factura, se tacha lo comprado. */
const LISTA_INICIAL = ['Queso costeño', 'Huevos', 'Café', 'Detergente'];

/**
 * Recetas que el simulador sugiere según lo que hay en la despensa. En la app
 * las propone la IA; aquí van escritas para que funcionen sin conexión.
 * ingredientes: [palabra que busca en el nombre, cómo se muestra].
 */
const RECETAS = [
  {
    id: 'pericos', nombre: 'Huevos pericos', emoji: '🍳', minutos: 10, comida: 'Desayuno',
    ingredientes: [['huevo', '3 huevos'], ['tomate', '1 tomate'], ['cebolla', '½ cebolla']],
    pasos: ['Pica el tomate y la cebolla en cuadritos.', 'Sofríelos 3 minutos con un poco de aceite.', 'Agrega los huevos batidos con sal y revuelve hasta que cuajen.'],
  },
  {
    id: 'changua', nombre: 'Changua', emoji: '🥣', minutos: 15, comida: 'Desayuno',
    ingredientes: [['leche', '2 tazas de leche'], ['huevo', '2 huevos'], ['pan', '2 tajadas de pan']],
    pasos: ['Calienta la leche con una taza de agua y sal.', 'Cuando hierva, rompe los huevos dentro y cocínalos 3 minutos.', 'Sirve sobre el pan en trozos.'],
  },
  {
    id: 'arepas', nombre: 'Arepas con queso', emoji: '🫓', minutos: 20, comida: 'Desayuno',
    ingredientes: [['harina de maiz', '2 tazas de harina de maíz'], ['queso', '1 taza de queso rallado']],
    pasos: ['Mezcla la harina con agua tibia y sal hasta tener una masa suave.', 'Agrega la mitad del queso y forma las arepas.', 'Ásalas por ambos lados y rellénalas con el resto del queso.'],
  },
  {
    id: 'pasta', nombre: 'Pasta con tomate y ajo', emoji: '🍝', minutos: 20, comida: 'Almuerzo',
    ingredientes: [['pasta', '250 g de pasta'], ['tomate', '3 tomates'], ['ajo', '2 dientes de ajo'], ['aceite', 'aceite']],
    pasos: ['Cocina la pasta en agua con sal.', 'Sofríe el ajo en aceite y agrega el tomate picado; cocina 8 minutos.', 'Mezcla la pasta con la salsa.'],
  },
  {
    id: 'chorreadas', nombre: 'Papas chorreadas', emoji: '🥔', minutos: 35, comida: 'Almuerzo',
    ingredientes: [['papa', '1 kg de papa'], ['tomate', '2 tomates'], ['cebolla', '1 cebolla'], ['crema de leche', 'crema de leche'], ['queso', 'queso']],
    pasos: ['Cocina las papas con cáscara en agua con sal.', 'Haz un hogao con tomate y cebolla; agrega la crema y el queso.', 'Sirve las papas bañadas en la salsa.'],
  },
  {
    id: 'pollo', nombre: 'Pollo salteado con verduras', emoji: '🍗', minutos: 30, comida: 'Almuerzo',
    ingredientes: [['pollo', '500 g de pechuga'], ['zanahoria', '1 zanahoria'], ['brocoli', '1 brócoli'], ['ajo', 'ajo']],
    pasos: ['Corta el pollo en tiras y dóralo con ajo.', 'Agrega la zanahoria en bastones y el brócoli en ramitos.', 'Saltea 6 minutos y ajusta la sal.'],
  },
  {
    id: 'yuca', nombre: 'Yuca con queso costeño', emoji: '🧀', minutos: 30, comida: 'Cena',
    ingredientes: [['yuca', '1 kg de yuca'], ['queso costeno', 'queso costeño']],
    pasos: ['Pela la yuca y cocínala en agua con sal hasta que ablande.', 'Sírvela caliente con el queso costeño rallado por encima.'],
  },
  {
    id: 'ensalada', nombre: 'Ensalada de aguacate', emoji: '🥗', minutos: 10, comida: 'Cena',
    ingredientes: [['aguacate', '1 aguacate'], ['tomate', '2 tomates'], ['lechuga', 'lechuga'], ['cebolla', '¼ de cebolla']],
    pasos: ['Lava y corta la lechuga.', 'Agrega el tomate, la cebolla y el aguacate en cubos.', 'Aliña con limón, aceite y sal.'],
  },
  {
    id: 'batido', nombre: 'Batido de fresa y banano', emoji: '🍓', minutos: 5, comida: 'Algo rápido',
    ingredientes: [['fresa', '1 taza de fresas'], ['banano', '1 banano'], ['yogur', '1 yogur']],
    pasos: ['Licúa todo con un poco de hielo.', 'Sirve de inmediato.'],
  },
  {
    id: 'jugo', nombre: 'Jugo de lulo', emoji: '🧃', minutos: 5, comida: 'Algo rápido',
    ingredientes: [['lulo', '4 lulos'], ['azucar', 'azúcar al gusto']],
    pasos: ['Corta los lulos y saca la pulpa.', 'Licúa con dos vasos de agua y azúcar, y cuela.'],
  },
];
