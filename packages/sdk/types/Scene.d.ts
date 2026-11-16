declare namespace ITHREEScene {
    interface SceneJSON extends import("three").SceneJSON {
        object: Object3DJSONObject,
        images?: Array<ImageJSON | string>;
        geometries?: import("three").BufferGeometryJSON[];
        textures?: import("three").TextureJSON[];
        materials?: import("three").MaterialJSON[];
        skeletons?: import("three").SkeletonJSON[];
        animations?: import("three").AnimationClipJSON[];
    }

    interface Object3DJSONObject{
        "uuid": string,
        "type": "Scene",
        "name": string,
        "layers": number,
        "matrix": number[],
        "up": [0 | 1, 0 | 1, 0 | 1],
        "background"?: string,
        "environment"?: string,
        "environmentType"?: "ModelViewer";
        "backgroundRotation"?: [number, number, number, string],
        "environmentRotation"?: [number, number, number, string],
        "children"?: Array<string | import("three").Object3DJSONObject>
    }

    interface ImageJSON {
        uuid: string;
        url: import("three").SerializedImage | KTX2ImageURL;
    }

    /**
     * Package 保存 KTX2 纹理时挂在 THREE.TextureSource 上的原始二进制
     */
    interface KTX2SourceData {
        buffer: ArrayBuffer;
        mimeType: string;
    }

    /**
     * 带有 Package KTX2 原始资源引用的 THREE.TextureSource
     */
    interface KTX2TextureSource extends import("three").TextureSource {
        uuid: string;
        __astralPackageKTX2?: KTX2SourceData;
        // Package 解包阶段临时持有的 KTX2 转码结果，只用于构建最终 Texture
        __astralPackageKTX2Texture?: import("three").CompressedTexture;
    }

    /**
     * Package 解包阶段传给 ObjectLoader 的 KTX2 图片描述
     */
    interface KTX2ImageURL {
        isPackageKTX2Texture: true;
        data: ArrayBuffer;
        mimeType: string;
    }

    /**
     * Package 打包阶段用于按原 TypedArray 类型重建独立 BufferAttribute 的构造器
     */
    interface BufferAttributeArrayConstructor {
        new(length: number): import("three").TypedArray;
    }

    /**
     * Package 打包阶段临时替换 interleaved 属性后需要恢复的原属性记录
     */
    interface InterleavedAttributeRestore {
        name: string;
        attribute: import("three").InterleavedBufferAttribute;
    }

    /**
     * Package 解包阶段等待真实 Bone 回填的骨骼绑定记录
     */
    interface PendingSkeletonBone {
        skeleton: import("three").Skeleton;
        boneIndex: number;
        skinnedMeshes: import("three").SkinnedMesh[];
    }

    /**
     * Package 解包阶段 Skeleton 与引用它的 SkinnedMesh 绑定关系
     */
    interface SkeletonBinding {
        skeleton: import("three").Skeleton;
        skinnedMeshes: import("three").SkinnedMesh[];
    }

    /**
     * three 运行时允许 SkinnedMesh 包围体为空，Package 解包重绑骨骼后需要清空缓存
     */
    interface SkinnedMeshBounds {
        boundingSphere: import("three").Sphere | null;
        boundingBox: import("three").Box3 | null;
    }

    /**
     * Package 解包时 ObjectLoader 临时创建的占位 Bone 标记
     */
    interface SkeletonPlaceholderBoneUserData {
        __astralPackageSkeletonPlaceholder?: true;
    }

    /**
     * 场景分包协议支持的材质贴图槽
     */
    type MaterialTextureProperty =
        | "map"
        | "matcap"
        | "alphaMap"
        | "lightMap"
        | "aoMap"
        | "bumpMap"
        | "normalMap"
        | "displacementMap"
        | "roughnessMap"
        | "metalnessMap"
        | "emissiveMap"
        | "specularMap"
        | "specularIntensityMap"
        | "specularColorMap"
        | "envMap"
        | "gradientMap"
        | "clearcoatMap"
        | "clearcoatRoughnessMap"
        | "clearcoatNormalMap"
        | "iridescenceMap"
        | "iridescenceThicknessMap"
        | "transmissionMap"
        | "thicknessMap"
        | "anisotropyMap"
        | "sheenColorMap"
        | "sheenRoughnessMap";

    interface MeshJSON extends import("three").MeshJSON {
        images: ImageJSON[];
        geometries: import("three").BufferGeometryJSON[];
        textures: import("three").TextureJSON[];
        materials: import("three").MaterialJSON[];
        skeletons?: import("three").SkeletonJSON[];
        animations?: import("three").AnimationClipJSON[];
    }
}

declare interface ISceneScript {
    "name": string,
    "source": string
}

declare interface ISceneJson {
    metadata: {},
    camera: {
        "metadata": {
            "version": number,
            "type": "Object",
            "generator": "Object3D.toJSON"
        },
        "object": {
            "uuid": string,
            "type": "PerspectiveCamera",
            "name": string,
            "layers": number,
            "matrix": number[],
            "up": [0 | 1, 0 | 1, 0 | 1],
            "fov": number,
            "zoom": number,
            "near": number,
            "far": number,
            "focus": number,
            "aspect": number,
            "filmGauge": number,
            "filmOffset": number
        }
    },
    scene: {
        "uuid": string,
        "metadata": {
            "version": number,
            "type": "Object",
            "generator": "Object3D.toJSON"
        },
        "textures": Array<import('three').Texture>,
        "images": string[],
        "object": ITHREEScene.Object3DJSONObject,
        "geometries"?: Array<any>,
        //groupChildren?: Array<string>
    },
    scripts: {
        [uuid: string]: ISceneScript[]
    },
    controls: {
        state: string
    },
    totalZipNumber: number,
    sceneInfo: IAppProject.SceneInfo,
}
