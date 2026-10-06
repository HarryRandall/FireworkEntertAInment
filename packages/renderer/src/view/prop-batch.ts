/** Static launch hardware shares one opaque draw with baked world transforms and linear colours. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { disposeTree } from './world';

// Linear RGB vertex colours have three scalar components, matching Three's material colour space.
const COLOUR_COMPONENTS = 3;

/** Consumes an owned hardware tree, baking metre transforms and colours into one mesh in a new group. */
export function batchProps(source: THREE.Group): THREE.Group {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  source.updateMatrixWorld(true);
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!(object.material instanceof THREE.MeshBasicMaterial))
      throw new TypeError('Hardware batching requires one basic material per mesh');
    const ownedGeometry: unknown = object.geometry;
    if (!(ownedGeometry instanceof THREE.BufferGeometry))
      throw new TypeError('Hardware batching requires buffer geometry');
    const geometry = (ownedGeometry as THREE.BufferGeometry)
      .clone()
      .applyMatrix4(object.matrixWorld);
    // Primitive face groups must not become separate renderer submissions.
    geometry.clearGroups();
    const colours = new Float32Array(geometry.getAttribute('position').count * COLOUR_COMPONENTS);
    const colour = object.material.color;
    for (let offset = 0; offset < colours.length; offset += COLOUR_COMPONENTS) {
      colours[offset] = colour.r;
      colours[offset + 1] = colour.g;
      colours[offset + 2] = colour.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, COLOUR_COMPONENTS));
    geometries.push(geometry);
  });
  try {
    if (geometries.length === 0) return group;
    const merged: unknown = mergeGeometries(geometries, false);
    if (!(merged instanceof THREE.BufferGeometry))
      throw new Error('Hardware geometries could not be batched');
    group.add(
      new THREE.Mesh(
        merged as THREE.BufferGeometry,
        new THREE.MeshBasicMaterial({ vertexColors: true }),
      ),
    );
    return group;
  } finally {
    for (const geometry of geometries) geometry.dispose();
    disposeTree(source);
  }
}
