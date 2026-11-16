import * as THREE from "three";
import { serializeMaterial } from "@/utils/scene/blending";

/**
 * 在对象以及后代中执行的回调函数,仅对满足条件的对象执行
 * @param callback - 以一个object3D对象作为第一个参数的函数。
 * @param condition - 需要满足该条件才继续后续回调的条件函数
 */
THREE.Object3D.prototype.traverseByCondition = function (callback, condition) {
    if (!condition(this)) return;

    callback(this);

    const children = this.children;

    // 优先使用子对象的traverseByCondition方法，如果没有则降级兜底
    const fallbackFn = (child) => {
        if (condition(child)) {
            callback(child);
        }
        child.children.forEach(grandChild => fallbackFn(grandChild));
    }

    for (let i = 0, l = children.length; i < l; i++) {
        // @ts-ignore
        if (children[i].traverseByCondition) {
            children[i].traverseByCondition(callback, condition);
        } else {
            // 降级兜底
            fallbackFn(children[i]);
        }
    }
}

/**
 * 判断 parentObj 是否是 当前对象 的任意层级祖先（包括祖父、曾祖父等）
 * @param parentObj - 可能是祖先的对象
 */
THREE.Object3D.prototype.isAncestor = function (parentObj) {
    let current: THREE.Object3D | null = this;
    while (current) {
        if (current === parentObj) return true;
        current = current.parent;
    }
    return false;
}

/**
 * 重写toJSON方法
 */
THREE.Object3D.prototype.toJSON = function (meta: any) {
    // 当从JSON.stringify调用时，meta是一个字符串
    const isRootObject = (meta === undefined || typeof meta === 'string');

    // @ts-ignore
    const output: any = {};

    // meta是一个散列，用于收集几何图形，材料。不提供它意味着这是被序列化的根对象。
    if (isRootObject) {
        meta = {
            geometries: {},
            materials: {},
            textures: {},
            images: {},
            shapes: {},
            skeletons: {},
            animations: {},
            nodes: {}
        };
        output.metadata = {
            version: 4.6,
            type: 'Object',
            generator: 'Astral.Object3D.toJSON'
        };
    }

    // 标准Object3D序列化
    const object: any = {
        uuid: this.uuid,
        type: this.type
    };

    if (this.name !== '') object.name = this.name;
    if (this.castShadow === true) object.castShadow = true;
    if (this.receiveShadow === true) object.receiveShadow = true;
    if (this.visible === false) object.visible = false;
    if (this.frustumCulled === false) object.frustumCulled = false;
    if (this.renderOrder !== 0) object.renderOrder = this.renderOrder;
    if (Object.keys(this.userData).length > 0) object.userData = this.userData;

    object.layers = this.layers.mask;
    object.matrix = this.matrix.toArray();
    object.up = this.up.toArray();

    if (this.matrixAutoUpdate === false) object.matrixAutoUpdate = false;

    // 对象特定属性
    if (this.isInstancedMesh) {
        object.type = 'InstancedMesh';
        object.count = this.count;
        object.instanceMatrix = this.instanceMatrix?.toJSON();
        if (this.instanceColor !== null) object.instanceColor = this.instanceColor?.toJSON();

    }

    if (this.isBatchedMesh) {
        object.type = 'BatchedMesh';
        object.perObjectFrustumCulled = this.perObjectFrustumCulled;
        object.sortObjects = this.sortObjects;

        object.drawRanges = this._drawRanges;
        object.reservedRanges = this._reservedRanges;

        object.visibility = this._visibility;
        object.active = this._active;
        object.bounds = this._bounds.map(bound => ({
            boxInitialized: bound.boxInitialized,
            boxMin: bound.box.min.toArray(),
            boxMax: bound.box.max.toArray(),

            sphereInitialized: bound.sphereInitialized,
            sphereRadius: bound.sphere.radius,
            sphereCenter: bound.sphere.center.toArray()
        }));

        object.maxInstanceCount = this._maxInstanceCount;
        object.maxVertexCount = this._maxVertexCount;
        object.maxIndexCount = this._maxIndexCount;

        object.geometryInitialized = this._geometryInitialized;
        object.geometryCount = this._geometryCount;

        object.matricesTexture = this._matricesTexture?.toJSON(meta);

        if (this._colorsTexture !== null) object.colorsTexture = this._colorsTexture?.toJSON(meta);

        if (this.boundingSphere !== null) {
            object.boundingSphere = {
                center: object.boundingSphere.center.toArray(),
                radius: object.boundingSphere.radius
            };
        }

        if (this.boundingBox !== null) {
            object.boundingBox = {
                min: object.boundingBox.min.toArray(),
                max: object.boundingBox.max.toArray()
            };
        }
    }

    function serialize(library, element) {
        if (library[element.uuid] === undefined) {
            library[element.uuid] = element.isMaterial ? serializeMaterial(element, meta) : element.toJSON(meta);
        }
        return element.uuid;
    }

    if (this.isScene) {
        if (this.background) {
            if (this.background.isColor) {
                object.background = this.background.toJSON();
            } else if (this.background.isTexture) {
                object.background = this.background.toJSON(meta).uuid;
            }
        }

        if (this.environment && this.environment.isTexture && this.environment.isRenderTargetTexture !== true) {
            object.environment = this.environment.toJSON(meta).uuid;
        }
    } else if (this.isMesh || this.isLine || this.isPoints) {
        object.geometry = serialize(meta.geometries, this.geometry);
        const parameters = this.geometry.parameters;

        if (parameters !== undefined && parameters.shapes !== undefined) {
            const shapes = parameters.shapes;
            if (Array.isArray(shapes)) {
                for (let i = 0, l = shapes.length; i < l; i++) {
                    const shape = shapes[i];
                    serialize(meta.shapes, shape);
                }
            } else {
                serialize(meta.shapes, shapes);
            }
        }
    }

    if (this.isSkinnedMesh) {
        object.bindMode = this.bindMode;
        object.bindMatrix = this.bindMatrix.toArray();

        if (this.skeleton !== undefined) {
            serialize(meta.skeletons, this.skeleton);
            object.skeleton = this.skeleton.uuid;
        }
    }

    if (this.material !== undefined) {
        // 判断元数据是否含有材质
        // 创建新变量替代，不然正在使用的材质被还原回this.metaData.material会造成播放异常
        let _material = this.material;
        if (this.metaData?.material) {
            if (this.metaData.material instanceof THREE.Material) {
                _material = this.metaData.material;
            }
        }

        if (Array.isArray(_material)) {
            const uuids: string[] = [];

            for (let i = 0, l = _material.length; i < l; i++) {
                uuids.push(serialize(meta.materials, _material[i]));
            }

            object.material = uuids;
        } else {
            object.material = serialize(meta.materials, _material);
        }
    }

    if (this.children.length > 0) {
        object.children = [];

        for (let i = 0; i < this.children.length; i++) {
            object.children.push(this.children[i].toJSON(meta).object);
        }
    }

    if (this.animations.length > 0) {
        object.animations = [];

        for (let i = 0; i < this.animations.length; i++) {
            let animation = this.animations[i];
            // 20250306 修复动画导出问题(代码中处理了object3D.animations,此属性下是AnimationAction数组)
            if (animation instanceof THREE.AnimationAction) {
                animation = animation.getClip();
            }
            if (!animation) continue;
            object.animations.push(serialize(meta.animations, animation));

        }
    }

    if (isRootObject) {
        const geometries = extractFromCache(meta.geometries);
        const materials = extractFromCache(meta.materials);
        const textures = extractFromCache(meta.textures);
        const images = extractFromCache(meta.images);
        const shapes = extractFromCache(meta.shapes);
        const skeletons = extractFromCache(meta.skeletons);
        const animations = extractFromCache(meta.animations);
        const nodes = extractFromCache(meta.nodes);

        if (geometries.length > 0) output.geometries = geometries;
        if (materials.length > 0) output.materials = materials;
        if (textures.length > 0) output.textures = textures;
        if (images.length > 0) output.images = images;
        if (shapes.length > 0) output.shapes = shapes;
        if (skeletons.length > 0) output.skeletons = skeletons;
        if (animations.length > 0) output.animations = animations.map(animation => {
            animation.tracks = animation.tracks.map(track => {
                if (!track.type) {
                    track.type = 'vector';
                }
                return track;
            });

            return animation;
        });
        if (nodes.length > 0) output.nodes = nodes;
    }

    output.object = object;

    return output;

    // 从缓存哈希中提取数据，删除每个项目上的元数据并作为数组返回
    function extractFromCache(cache) {
        const values: any = [];
        for (const key in cache) {
            const data = cache[key];
            delete data.metadata;
            values.push(data);
        }

        return values;
    }
}
