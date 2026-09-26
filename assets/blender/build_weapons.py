"""
Prepara las armas del juego a partir del pack WWII y las exporta en un solo GLB.

    blender --background --python assets/blender/build_weapons.py

Entrada: assets/source/weapons/weapons/LowPolyWWIIWeaponsSketchfab.blend
Salida:  apps/client/public/assets/models/weapons/weapons.glb

=====================================================================
 CONTRATO CON EL CLIENTE (no romper)
=====================================================================
  - Cada objeto se llama como el id del arma en packages/config, y su MALLA
    se llama distinto (`<id>_mesh`): si coinciden, GLTFLoader renombra el nodo
    al cargar y el cliente deja de encontrarlo.
  - El ORIGEN del objeto está en la EMPUÑADURA, donde lo agarra la mano.
  - El CAÑÓN apunta a +Y en Blender, que al exportar con "+Y up" pasa a
    ser -Z de glTF: la dirección de disparo del juego.
  - La parte de ARRIBA del arma es +Z en Blender.
  - El cargador extraíble se exporta EMPARENTADO al arma y se llama
    `<id>__mag`, para que el animador pueda soltarlo en la recarga.

  - Cada arma exportada tiene TRANSFORMACIÓN IDENTIDAD. Es obligatorio:
    `cloneWeapon` en el cliente hace `clone.scale.set(1,1,1)`, así que
    cualquier escala que quede en el nodo se pierde y el arma saldría con
    el tamaño crudo de la malla (24 veces más grande). Ojo: el
    `export_apply` del exportador aplica MODIFICADORES, no
    transformaciones de objeto; hay que hornearlas a mano.
=====================================================================

Las armas del pack vienen con el eje largo en X, la boca hacia +X, sin
rotación y con el origen disperso por la escena. Este script las coloca.
"""
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FUENTE = ROOT / "assets/source/weapons/weapons/LowPolyWWIIWeaponsSketchfab.blend"
OUT = ROOT / "apps/client/public/assets/models/weapons/weapons.glb"

# El personaje mide 1,20 m. A tamaño real el M1 Garand (1,10 m) es casi tan
# alto como él y le tapa la cabeza en tercera persona. Al 65 % queda con el
# mismo peso visual que tenían las armas procedurales.
ESCALA = 0.65


@dataclass
class Pieza:
    """Una entrada del catálogo y cómo se saca del pack."""

    malla: str
    #: Punto de la malla original que tiene que acabar en el origen.
    empunadura: tuple
    #: Centro aproximado de la isla del cargador, o None si no es extraíble.
    #: Se mide una vez sobre el .blend; la isla se elige por cercanía.
    cargador: tuple = None
    #: Giro extra sobre el eje del cañón, en grados, para enderezar la pieza.
    alabeo: float = 0.0


# Medido sobre el .blend con el script de inspección. Los valores de
# `empunadura` se afinan mirando renders del arma en la mano, no a ojo.
PIEZAS: dict = {
    "ka_bar": Pieza(malla="KA BAR", empunadura=(-0.045, 0.0, 0.999)),
    "tt_pistol": Pieza(
        malla="TT Pistol", empunadura=(0.372, 0.0, 0.530), cargador=(0.370, 0.0, 0.536)
    ),
    "mauser_c96": Pieza(malla="Mauser C96", empunadura=(-0.049, 0.0, 0.523)),
    "ppsh_41": Pieza(
        malla="PPSH 41", empunadura=(1.140, 0.0, 0.140), cargador=(1.345, 0.002, 0.116)
    ),
    "thompson_m1": Pieza(
        malla="Thompson M1", empunadura=(1.140, 0.0, 0.560), cargador=(1.264, 0.0, 0.544)
    ),
    "stg_44": Pieza(
        malla="STG 44", empunadura=(-1.360, 0.0, 0.010), cargador=(-1.140, 0.0, 0.037)
    ),
    "m1_garand": Pieza(malla="M1 Garand", empunadura=(-0.120, 0.0, 0.085)),
    "grenade_mk2": Pieza(malla="MK2 Grenade", empunadura=(-0.952, 0.0, 0.545)),
    "grenade_stick": Pieza(malla="German Stick Grenade", empunadura=(-1.198, 0.0, 0.470)),
}


def _caja(obj):
    """Caja englobante en coordenadas de mundo."""
    mn = Vector((1e9,) * 3)
    mx = Vector((-1e9,) * 3)
    for esquina in obj.bound_box:
        p = obj.matrix_world @ Vector(esquina)
        mn = Vector(min(mn[i], p[i]) for i in range(3))
        mx = Vector(max(mx[i], p[i]) for i in range(3))
    return mn, mx


def _centro(obj):
    mn, mx = _caja(obj)
    return (mn + mx) / 2


def _solo(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def _aplicar(objs):
    """Hornea posición, rotación y escala en los vértices."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def _partir_cargador(cuerpo, cerca):
    """
    Separa la isla del cargador del resto del cuerpo.

    Los cargadores vienen soldados al arma pero son islas de geometría
    independientes, así que se pueden desprender sin tocar la malla a mano.
    La isla se elige por cercanía a un punto medido, porque hacerlo por
    tamaño confunde el cargador con cualquier otro tubo del arma.
    """
    _solo(cuerpo)
    bpy.ops.mesh.separate(type="LOOSE")
    partes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    objetivo = Vector(cerca)
    mag = min(partes, key=lambda o: (_centro(o) - objetivo).length)
    resto = [o for o in partes if o is not mag]
    # Volver a unir todo lo que no es el cargador en una sola malla.
    bpy.ops.object.select_all(action="DESELECT")
    for o in resto:
        o.select_set(True)
    bpy.context.view_layer.objects.active = resto[0]
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active, mag


def construir(wid: str, pieza: Pieza):
    original = bpy.data.objects.get(pieza.malla)
    if original is None:
        raise SystemExit(f"falta la malla {pieza.malla!r} en el pack")

    cuerpo = original.copy()
    cuerpo.data = original.data.copy()
    bpy.context.scene.collection.objects.link(cuerpo)
    # La malla trae escala de objeto: se hornea ya para poder medir en metros.
    _aplicar([cuerpo])

    mag = None
    if pieza.cargador is not None:
        cuerpo, mag = _partir_cargador(cuerpo, pieza.cargador)

    piezas = [cuerpo] + ([mag] if mag else [])

    # 1) La empuñadura al origen.
    desplazamiento = -Vector(pieza.empunadura)
    for o in piezas:
        o.location = o.location + desplazamiento
    _aplicar(piezas)

    # 2) Girar +90° sobre Z: la boca pasa de +X a +Y, que es lo que espera
    #    el juego. Y encoger al tamaño chibi.
    import math

    for o in piezas:
        o.rotation_euler = (math.radians(pieza.alabeo), 0.0, math.radians(90.0))
        o.scale = (ESCALA, ESCALA, ESCALA)
    _aplicar(piezas)

    # 3) Nombres del contrato y emparentado del cargador.
    #
    #    La MALLA se llama distinto que el OBJETO a propósito. GLTFLoader
    #    deduplica nombres al cargar: si la malla ya reclamó `stg_44`, al nodo
    #    le toca `stg_44_1` y el cliente, que busca por `stg_44`, no lo
    #    encuentra y se cae al arma procedural sin decir nada. Con el sufijo
    #    `_mesh` el nombre del nodo queda libre.
    cuerpo.name = wid
    cuerpo.data.name = f"{wid}_mesh"
    if mag:
        mag.name = f"{wid}__mag"
        mag.data.name = f"{wid}__mag_mesh"
        mag.parent = cuerpo
        mag.matrix_parent_inverse = cuerpo.matrix_world.inverted()

    mn, mx = _caja(cuerpo)
    d = mx - mn
    print(
        f"ARMA {wid:15s} largo={d.y:.3f} alto={d.z:.3f} ancho={d.x:.3f} "
        f"cargador={'sí' if mag else 'no'}"
    )
    return piezas


def main():
    bpy.ops.wm.open_mainfile(filepath=str(FUENTE))

    # Fuera todo lo que no sea una de las armas elegidas: el pack trae balas,
    # vainas, luces y armas de repuesto que no van al juego.
    usadas = {p.malla for p in PIEZAS.values()}
    for obj in list(bpy.data.objects):
        if obj.name not in usadas:
            bpy.data.objects.remove(obj, do_unlink=True)

    exportar = []
    originales = {p.malla for p in PIEZAS.values()}
    for wid, pieza in PIEZAS.items():
        exportar += construir(wid, pieza)

    # Las mallas originales ya solo estorban.
    for nombre in originales:
        obj = bpy.data.objects.get(nombre)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)

    # Comprobación del contrato antes de exportar: cualquier transformación
    # que sobreviva aquí se pierde en el cliente y el arma sale deformada.
    for o in exportar:
        if o.parent is not None:
            continue
        assert o.location.length < 1e-5, f"{o.name} conserva posición {o.location[:]}"
        assert all(abs(s - 1.0) < 1e-5 for s in o.scale), f"{o.name} conserva escala"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        use_selection=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    print("WEAPONS OK", len(PIEZAS), sorted(PIEZAS))


if __name__ == "__main__":
    main()
