import { saveArrayBuffer, saveString, getAnimations, getAnimationClips } from '#/utils';
import App from "#/core/app/App";

class Export {
    constructor() {
    }

    /*********************************导出物体*******************************************/
    //导出为JSON
    exportObjectToJSON() {
        if (!App.selected) return;

        const json = App.selected.toJSON();
        let output: string;
        try {
            output = JSON.stringify(json, null, '\t');
            output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, '$1');
        } catch (e) {
            output = JSON.stringify(json);
        }

        saveString(output, 'Astral3DModel.json');
    }

    // 导出为glb
    async exportObjectToGlb() {
        if (!App.selected) return;

        const animations = getAnimationClips(App.selected);

        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

        const exporter = new GLTFExporter();

        exporter.parse(
            App.selected,
            function (result) {
                saveArrayBuffer(result, 'Astral3DModel.glb');
            },
            (err) => {
                App.log.info(`导出物体为glb错误：${err.message}`)
            },
            { binary: true, animations: animations }
        );
    }

    //导出为gltf
    async exportObjectToGltf() {
        if (!App.selected) return;

        const animations = getAnimations();

        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const exporter = new GLTFExporter();

        exporter.parse(
            App.selected,
            function (result) {
                saveString(JSON.stringify(result, null, 2), 'Astral3DModel.gltf');
            },
            () => { },
            { animations: animations }
        );
    }

    //导出为obj
    async exportObjectToObj() {
        if (!App.selected) return;

        const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');

        const exporter = new OBJExporter();

        saveString(exporter.parse(App.selected), 'Astral3DModel.obj');
    }

    //导出为ply
    async exportObjectToPly() {
        if (!App.selected) return;

        const { PLYExporter } = await import('three/examples/jsm/exporters/PLYExporter.js');

        const exporter = new PLYExporter();

        exporter.parse(
            App.selected,
            function (result) {
                saveArrayBuffer(result, 'Astral3DModel.ply');
            },
            {}
        );
    }

    // 导出为ply二进制
    async exportObjectToPlyBinary() {
        if (!App.selected) return;

        const { PLYExporter } = await import('three/examples/jsm/exporters/PLYExporter.js');

        const exporter = new PLYExporter();

        exporter.parse(
            App.selected,
            function (result) {
                saveArrayBuffer(result, 'Astral3DModel-binary.ply');
            },
            { binary: true }
        );
    }

    //导出为STL
    async exportObjectToStl() {
        if (!App.selected) return;

        const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');

        const exporter = new STLExporter();

        saveString(exporter.parse(App.selected), 'Astral3DModel.stl');
    }

    //导出为STL(二进制)
    async exportObjectToStlBinary() {
        if (!App.selected) return;

        const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');

        const exporter = new STLExporter();

        saveArrayBuffer(exporter.parse(App.selected, { binary: true }), 'Astral3DModel-binary.stl');
    }

    //导出为USDZ
    async exportObjectToUSDZ() {
        if (!App.selected) return;

        const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');

        const exporter = new USDZExporter();
        saveArrayBuffer(await exporter.parseAsync(App.selected, {}), 'Astral3DModel.usdz');
    }

    /*********************************导出场景*******************************************/
    //导出为JSON
    exportSceneToJSON() {
        const json = App.getSceneWithoutIgnore().toJSON();
        let output: string;
        try {
            output = JSON.stringify(json, null, '\t');
            output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, '$1');
        } catch (e) {
            output = JSON.stringify(json);
        }

        saveString(output, 'Astral3DScene.json');
    }

    // 导出为glb
    async exportSceneToGlb() {
        const animations = getAnimationClips();

        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

        const exporter = new GLTFExporter();

        exporter.parse(
            App.getSceneWithoutIgnore(),
            function (result) {
                saveArrayBuffer(result, 'Astral3DScene.glb');
            },
            () => {
            },
            { binary: true, animations: animations }
        );
    }

    //导出为gltf
    async exportSceneToGltf() {
        const animations = getAnimations();

        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const exporter = new GLTFExporter();

        exporter.parse(
            App.getSceneWithoutIgnore(),
            function (result) {
                saveString(JSON.stringify(result, null, 2), 'Astral3DScene.gltf');
            },
            () => { },
            { animations: animations }
        );
    }

    //导出为obj
    async exportSceneToObj() {
        const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');

        const exporter = new OBJExporter();

        saveString(exporter.parse(App.getSceneWithoutIgnore()), 'Astral3DScene.obj');
    }

    //导出为ply
    async exportSceneToPly() {
        const { PLYExporter } = await import('three/examples/jsm/exporters/PLYExporter.js');

        const exporter = new PLYExporter();

        exporter.parse(
            App.getSceneWithoutIgnore(),
            function (result) {
                saveArrayBuffer(result, 'Astral3DScene.ply');
            },
            {}
        );
    }

    // 导出为ply二进制
    async exportSceneToPlyBinary() {
        const { PLYExporter } = await import('three/examples/jsm/exporters/PLYExporter.js');

        const exporter = new PLYExporter();

        exporter.parse(
            App.getSceneWithoutIgnore(),
            function (result) {
                saveArrayBuffer(result, 'Astral3DScene-binary.ply');
            },
            { binary: true }
        );
    }

    //导出为STL
    async exportSceneToStl() {
        const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');

        const exporter = new STLExporter();

        saveString(exporter.parse(App.getSceneWithoutIgnore()), 'Astral3DScene.stl');
    }

    //导出为STL(二进制)
    async exportSceneToStlBinary() {
        const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');

        const exporter = new STLExporter();

        saveArrayBuffer(exporter.parse(App.getSceneWithoutIgnore(), { binary: true }), 'Astral3DScene-binary.stl');
    }

    //导出为USDZ
    async exportSceneToUSDZ() {
        const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');

        const exporter = new USDZExporter();
        saveArrayBuffer(await exporter.parseAsync(App.getSceneWithoutIgnore(), {}), 'Astral3DScene.usdz');
    }
}

export { Export };
