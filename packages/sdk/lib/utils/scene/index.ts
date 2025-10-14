import { Object3D, InstancedMesh, Mesh, Matrix4, AnimationAction, AnimationClip } from "three";
import App from "#/core/app/App";

export * from "./material";
export * from "./Stats";
export * from "./controls";

/**
 * 获取对象到父对象的路径(结果不包含parentObject)
 * @param parentObject
 * @param object
 * @param attr 对象属性名
 * @param splitter 路径分隔符
 */
export function getParentPath(parentObject: Object3D, object: Object3D, attr = 'name', splitter = '/') {
    if (!parentObject || !object) return '';

    if (parentObject === object) return object[attr];

    let path = [object[attr]];

    const getPath = (obj) => {
        if (!obj.parent) return;

        if (obj.parent === parentObject) return;

        path.unshift(obj.parent[attr]);

        getPath(obj.parent);
    }
    getPath(object);

    return path.join(splitter);
}

/**
 * 获取鼠标按下的位置
 * @param dom
 * @param x
 * @param y
 */
export function getMousePosition(dom: HTMLElement, x: number, y: number) {
    const rect = dom.getBoundingClientRect();
    return [(x - rect.left) / rect.width, (y - rect.top) / rect.height];
}

/**
 * InstancedMesh 解出所有 mesh
 */
export function getMeshByInstancedMesh(instancedMesh: InstancedMesh) {
    const meshes: Mesh[] = [];
    // if (instancedMesh.material === undefined) return meshes;

    const matrixWorld = instancedMesh.matrixWorld;
    const count = instancedMesh.count;

    for (let instanceId = 0; instanceId < count; instanceId++) {
        const _mesh = new Mesh();
        const _instanceLocalMatrix = new Matrix4();
        const _instanceWorldMatrix = new Matrix4();

        _mesh.geometry = instancedMesh.geometry;
        _mesh.material = instancedMesh.material;

        // 计算每个实例的世界矩阵
        instancedMesh.getMatrixAt(instanceId, _instanceLocalMatrix);

        _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix);

        // 网格表示这个单一实例
        _mesh.matrixWorld = _instanceWorldMatrix;

        meshes.push(_mesh);
    }

    return meshes;
}

/**
 * 判断是否是group,因为导入有可能存在被定义为Object3D类型的group
 */
export function isGroup(object3D: Object3D) {
    return (object3D.isGroup || object3D.children.length > 0)
}

/**
 * 判断是否是代理粒子发射器的3D对象
 */
export function isParticleObject(object: Object3D | null) {
    return object && object.type === "Particle" && object.emitter;
}

/**
 * 判断是否是Billboard 3D对象
 */
export function isBillboardObject(object: Object3D | null) {
    return object && object.type === "Billboard" && object.options;
}

/**
 * 判断是否是HtmlPanel 3D对象
 */
export function isHtmlPanelObject(object: Object3D | null) {
    return object && (object.isHtmlPanel || object.isHtmlSprite) && object.element;
}

/**
 * 判断是否是3DTiles对象
 */
export function is3DTilesObject(object: Object3D | null) {
    return object && (object.isTilesGroup || object.type === "TilesGroup") && object.options;
}

/**
 * 获取场景/物体中的所有动画
 */
export function getAnimations(object = App.scene) {
    const animations: any = [];

    object.traverse(function (object) {
        animations.push(...object.animations);
    });

    return animations;
}

/**
 * 获取场景/物体中的所有动画剪辑
 */
export function getAnimationClips(object: Object3D = App.scene) {
    const animations: any = [];

    object.traverse(function (object) {
        object.animations.forEach(animation => {
            if (animation instanceof AnimationAction) {
                animations.push(animation.getClip());
            }

            if (animation instanceof AnimationClip) {
                animations.push(animation);
            }
        })
    });

    return animations;
}