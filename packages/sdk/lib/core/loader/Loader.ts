import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { AddObjectCommand } from '../commands/AddObjectCommand';
import { SetSceneCommand } from '../commands/Commands';
import { useDispatchSignal } from "#/hooks";
import { ObjectLoader } from './ObjectLoader';
import App from "#/core/app/App";
import MaterialCreator = MTLLoader.MaterialCreator;

const LoaderUtils = {
    createFilesMap: function (files: FileList | File[]) {
        const map = {};

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            map[file.name] = file;
        }

        return map;
    },
    getFilesFromItemList: function (items: DataTransferItem[], onDone: (files: File[], filesMap) => void) {
        // TOFIX: setURLModifier() breaks when the file being loaded is not in root
        let itemsCount = 0;
        let itemsTotal = 0;

        const files: File[] = [];
        const filesMap = {};

        function onEntryHandled() {

            itemsCount++;

            if (itemsCount === itemsTotal) {

                onDone(files, filesMap);

            }

        }

        function handleEntry(entry) {

            if (entry.isDirectory) {

                const reader = entry.createReader();
                reader.readEntries(function (entries) {

                    for (let i = 0; i < entries.length; i++) {

                        handleEntry(entries[i]);

                    }

                    onEntryHandled();

                });

            } else if (entry.isFile) {

                entry.file(function (file) {

                    files.push(file);

                    filesMap[entry.fullPath.slice(1)] = file;
                    onEntryHandled();

                });

            }

            itemsTotal++;

        }

        for (let i = 0; i < items.length; i++) {

            const item = items[i];

            if (item.kind === 'file') {

                handleEntry(item.webkitGetAsEntry());

            }

        }

    }

};

class Loader {
    protected texturePath: string = '';
    protected _objectLoader: ObjectLoader | null = null;
    protected _dracoLoader: DRACOLoader | null = null;
    protected _ktx2Loader: KTX2Loader | null = null;
    public _ifcLoader: any = null;
    protected rgbeLoader: RGBELoader | null = null;
    protected tgaLoader: TGALoader | null = null;
    protected _exrLoader: EXRLoader | null = null;
    protected textureLoader: THREE.TextureLoader | null = null;

    constructor() { }

    get objectLoader(): ObjectLoader {
        if (!this._objectLoader) {
            this._objectLoader = new ObjectLoader();
        }

        return this._objectLoader;
    }

    set objectLoader(value: ObjectLoader | null) {
        this._objectLoader = value;
    }

    get dracoLoader(): DRACOLoader {
        if (!this._dracoLoader) {
            this._dracoLoader = new DRACOLoader();
            this._dracoLoader.setDecoderPath(new URL(import.meta.env.BASE_URL + 'libs/draco/gltf', import.meta.url).href + "/");
        }

        return this._dracoLoader;
    }

    set dracoLoader(value: DRACOLoader | null) {
        this._dracoLoader = value;
    }

    get ktx2Loader(): KTX2Loader {
        if (!this._ktx2Loader) {
            this._ktx2Loader = new KTX2Loader();
            this._ktx2Loader.setTranscoderPath(new URL(import.meta.env.BASE_URL + 'libs/basis', import.meta.url).href + "/");
            useDispatchSignal("rendererDetectKTX2Support", this._ktx2Loader);
        }

        return this._ktx2Loader;
    }

    set ktx2Loader(value: KTX2Loader | null) {
        this._ktx2Loader = value;
    }

    get exrLoader(): EXRLoader {
        if (!this._exrLoader) {
            this._exrLoader = new EXRLoader();
        }

        return this._exrLoader;
    }

    set exrLoader(value: EXRLoader | null) {
        this._exrLoader = value;
    }

    loadItemList(items) {
        LoaderUtils.getFilesFromItemList(items, (files, filesMap) => {
            this.loadFiles(files, filesMap);
        });
    }

    loadFiles(files, filesMap): Promise<THREE.Object3D[]> {
        return new Promise((resolve, reject) => {
            const promises: Promise<THREE.Object3D>[] = [];

            if (files.length > 0) {
                filesMap = filesMap || LoaderUtils.createFilesMap(files);
                const manager = new THREE.LoadingManager();
                manager.setURLModifier(function (url) {
                    url = url.replace(/^(\.?\/)/, ''); // remove './'
                    const file = filesMap[url];
                    if (file) {
                        return URL.createObjectURL(file);
                    }
                    return url;
                });
                manager.addHandler(/\.tga$/i, new TGALoader());
                manager.addHandler(/\.mtl$/i, new MTLLoader());

                /** 2023/02/03 二三：判断是否存在mtl文件，存在则提前解析 **/
                // @ts-ignore
                const mtlIndex = Object.values(files).findIndex((item: File) => item.name?.split('.').pop().toLowerCase() === "mtl");
                let mtlMaterials: MaterialCreator | null = null;
                if (mtlIndex !== -1) {
                    const mtlLoader = new MTLLoader();
                    const reader = new FileReader();
                    reader.addEventListener('load', (event) => {
                        const contents = event.target?.result as string;
                        const materials = mtlLoader.parse(contents, "");
                        materials.preload();
                        mtlMaterials = materials;
                        for (let i = 0; i < files.length; i++) {
                            promises.push(this.loadFile(files[i], manager, mtlMaterials));
                        }
                        Promise.all(promises).then((models) => {
                            resolve(models);
                        }).catch(error => {
                            reject(error);
                        });
                    }, false);
                    reader.readAsText(files[mtlIndex]);
                } else {
                    for (let i = 0; i < files.length; i++) {
                        promises.push(this.loadFile(files[i], manager));
                    }
                    Promise.all(promises).then((models) => {
                        resolve(models);
                    }).catch(error => {
                        reject(error);
                    });
                }
            } else {
                reject("No files to load.");
            }
        })
    }

    loadFile(file, manager: THREE.LoadingManager = new THREE.LoadingManager(), mtlMaterials: MaterialCreator | null = null, addToScene = true): Promise<THREE.Object3D> {
        return new Promise((resolve, reject) => {
            const filename = file.name;
            const extension = filename.split('.').pop().toLowerCase();

            const reader = new FileReader();
            // reader.addEventListener( 'progress', function ( event ) {
            // 	const size = '(' + Math.floor( event.total / 1000 ).format() + ' KB)';
            // 	const progress = Math.floor( ( event.loaded / event.total ) * 100 ) + '%';
            // 	console.log( 'Loading', filename, size, progress );
            // } );

            switch (extension) {
                case '3dm':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result;

                        const { Rhino3dmLoader } = await import('three/examples/jsm/loaders/3DMLoader.js');

                        const loader = new Rhino3dmLoader();
                        loader.setLibraryPath('../examples/jsm/libs/rhino3dm/');
                        loader.parse(contents as ArrayBufferLike, function (object) {
                            addToScene && App.execute(new AddObjectCommand(object));

                            resolve(object);
                        });
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case '3ds':
                    reader.addEventListener('load', async function (event) {
                        const { TDSLoader } = await import('three/examples/jsm/loaders/TDSLoader.js');

                        const loader = new TDSLoader();
                        //@ts-ignore
                        const object = loader.parse(event.target.result);

                        addToScene && App.execute(new AddObjectCommand(object));

                        resolve(object);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case '3mf':
                    reader.addEventListener('load', async function (event) {
                        const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
                        const loader = new ThreeMFLoader();
                        const object = loader.parse(event.target?.result as ArrayBuffer);

                        addToScene && App.execute(new AddObjectCommand(object));

                        resolve(object);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case 'amf':
                    reader.addEventListener('load', async function (event) {
                        const { AMFLoader } = await import('three/examples/jsm/loaders/AMFLoader.js');

                        const loader = new AMFLoader();
                        const amfobject = loader.parse(event.target?.result as ArrayBuffer);

                        addToScene && App.execute(new AddObjectCommand(amfobject));

                        resolve(amfobject);
                    }, false);
                    reader.readAsArrayBuffer(file);

                    break;
                case 'dae':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as string;

                        const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');

                        const loader = new ColladaLoader(manager);
                        //@ts-ignore
                        const collada = loader.parse(contents);

                        collada.scene.name = filename;

                        addToScene && App.execute(new AddObjectCommand(collada.scene));

                        resolve(collada.scene);
                    }, false);
                    reader.readAsText(file);

                    break;
                case 'drc':
                    reader.addEventListener('load', async (event) => {
                        const contents = event.target?.result as ArrayBuffer;

                        // this.dracoLoader.setDecoderPath(new URL(import.meta.env.BASE_URL + 'libs/draco/', import.meta.url).href);
                        this.dracoLoader.parse(contents, (geometry) => {
                            let object;
                            if (geometry.index !== null) {
                                const material = new THREE.MeshStandardMaterial();

                                object = new THREE.Mesh(geometry, material);
                                object.name = filename;
                            } else {
                                const material = new THREE.PointsMaterial({ size: 0.01 });
                                material.vertexColors = geometry.hasAttribute('color');

                                object = new THREE.Points(geometry, material);
                                object.name = filename;
                            }

                            this.dracoLoader.dispose();
                            this.dracoLoader = null;

                            addToScene && App.execute(new AddObjectCommand(object));

                            resolve(object);
                        });
                    }, false);
                    reader.readAsArrayBuffer(file);

                    break;
                case 'fbx':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result;

                        const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

                        const loader = new FBXLoader(manager);
                        //@ts-ignore
                        const object = loader.parse(contents as ArrayBuffer);

                        addToScene && App.execute(new AddObjectCommand(object));

                        resolve(object);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case 'glb':
                    reader.addEventListener('load', async (event) => {
                        const contents = event.target?.result as ArrayBuffer;

                        const loader = await this.createGLTFLoader(manager);
                        loader.parse(contents, '', (result) => {
                            const scene = result.scene;
                            scene.name = filename;

                            scene.animations.push(...result.animations);
                            addToScene && App.execute(new AddObjectCommand(scene));

                            this.disposeGLTFLoaderEffects(loader);

                            resolve(scene);
                        });
                    }, false);
                    reader.readAsArrayBuffer(file);

                    break;
                case 'gltf':
                    reader.addEventListener('load', async (event) => {
                        const contents = event.target?.result as ArrayBuffer;
                        const loader = await this.createGLTFLoader(manager);

                        loader.parse(contents, '', (result) => {
                            const scene = result.scene;
                            scene.name = filename;

                            scene.animations.push(...result.animations);
                            addToScene && App.execute(new AddObjectCommand(scene));

                            this.disposeGLTFLoaderEffects(loader);

                            resolve(scene);
                        });
                    }, false);
                    reader.readAsArrayBuffer(file);

                    break;
                case 'js':
                case 'json':
                    reader.addEventListener('load', (event) => {
                        const contents: string = event.target?.result as string;

                        // 2.0
                        if (contents.indexOf('postMessage') !== - 1) {
                            const blob = new Blob([contents], { type: 'text/javascript' });
                            const url = URL.createObjectURL(blob);

                            const worker = new Worker(url);

                            worker.onmessage = (event) => {
                                event.data.metadata = { version: 2 };
                                this.handleJSON(event.data, addToScene).then(object => resolve(object as THREE.Object3D)).catch(error => reject(error));
                            };

                            worker.postMessage(Date.now());
                            return;
                        }

                        // >= 3.0

                        let data;
                        try {
                            data = JSON.parse(contents);
                        } catch (error) {
                            App.log.error(error as string);
                            return;
                        }
                        this.handleJSON(data, addToScene).then(object => resolve(object as THREE.Object3D)).catch(error => reject(error));
                    }, false);
                    reader.readAsText(file);

                    break;
                case 'ifc':
                    reader.addEventListener('load', async (event) => {
                        if (!this._ifcLoader) {
                            const { IFCLoader } = await import("web-ifc-three/IFCLoader");

                            this._ifcLoader = new IFCLoader();

                            const ifcWorkerUrl = new URL(import.meta.env.BASE_URL + 'libs/web-ifc/IFCWorker.js', import.meta.url).href;
                            this._ifcLoader.ifcManager.useWebWorkers(true, ifcWorkerUrl).then(async () => {
                                if (!this._ifcLoader) return;

                                await this._ifcLoader.ifcManager.setWasmPath('/');

                                // const { IFCSPACE } = await import('web-ifc');
                                // await this._ifcLoader.ifcManager.parser.setupOptionalCategories( {
                                // 	[ IFCSPACE ]: false,
                                // });

                                await this._ifcLoader.ifcManager.applyWebIfcConfig({
                                    // 使用更快的（不那么精确的）布尔逻辑
                                    USE_FAST_BOOLS: true
                                });
                            })
                        }


                        const model = await this._ifcLoader.parse(event.target?.result as ArrayBuffer);
                        model.name = filename;
                        model.isIFC = true;
                        addToScene && App.execute(new AddObjectCommand(model));

                        resolve(model);
                    }, false);
                    reader.readAsArrayBuffer(file);

                    break;
                // case 'ifc':
                // 	reader.addEventListener( 'load', async function ( event ) {
                // 		const { IFCLoader } = await import( 'three/examples/jsm/loaders/IFCLoader.js' );
                //
                // 		const loader = new IFCLoader();
                // 		loader.ifcManager.setWasmPath( 'three/examples/jsm/loaders/ifc/' );
                //
                // 		// @ts-ignore
                // 		const model = await loader.parse( event.target.result );
                // 		model.mesh.name = filename;
                //
                // 		App.execute( new AddObjectCommand(model.mesh));
                // 	}, false );
                // 	reader.readAsArrayBuffer( file );
                // 	break;
                case 'kmz':
                    reader.addEventListener('load', async function (event) {
                        const { KMZLoader } = await import('three/examples/jsm/loaders/KMZLoader.js');

                        const loader = new KMZLoader();
                        const collada = loader.parse(event.target?.result as ArrayBuffer);
                        collada.scene.name = filename;
                        addToScene && App.execute(new AddObjectCommand(collada.scene));

                        resolve(collada.scene);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case 'ldr':
                case 'mpd':
                    reader.addEventListener('load', async function (event) {
                        const { LDrawLoader } = await import('three/examples/jsm/loaders/LDrawLoader.js');

                        const loader = new LDrawLoader();
                        loader.setPath('three/examples/models/ldraw/officialLibrary/');
                        // @ts-ignore
                        loader.parse(event.target?.result as string, undefined, function (group) {
                            group.name = filename;
                            // Convert from LDraw coordinates: rotate 180 degrees around OX
                            group.rotation.x = Math.PI;

                            addToScene && App.execute(new AddObjectCommand(group));

                            resolve(group);
                        });
                    }, false);
                    reader.readAsText(file);
                    break;
                case 'md2':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as ArrayBuffer;

                        const { MD2Loader } = await import('three/examples/jsm/loaders/MD2Loader.js');

                        const geometry = new MD2Loader().parse(contents);
                        const material = new THREE.MeshStandardMaterial();

                        const mesh = new THREE.Mesh(geometry, material);
                        //@ts-ignore
                        mesh.mixer = new THREE.AnimationMixer(mesh);
                        mesh.name = filename;
                        //@ts-ignore
                        mesh.animations.push(...geometry.animations);
                        addToScene && App.execute(new AddObjectCommand(mesh));

                        resolve(mesh);
                    }, false);
                    reader.readAsArrayBuffer(file);

                    break;
                case 'obj':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as string;

                        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
                        const objLoader = new OBJLoader();

                        /** 2023/02/03 二三：判断是否存在已解析的mtl文件 **/
                        if (mtlMaterials !== null) {
                            objLoader.setMaterials(mtlMaterials);
                        }

                        const object = objLoader.parse(contents);
                        object.name = filename;

                        addToScene && App.execute(new AddObjectCommand(object));

                        resolve(object);
                    }, false);
                    reader.readAsText(file);

                    break;
                case 'mtl':
                    //mtl文件已经提前预加载
                    break;
                case 'pcd':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as ArrayBuffer;

                        const { PCDLoader } = await import('three/examples/jsm/loaders/PCDLoader.js');

                        const points = new PCDLoader().parse(contents);
                        points.name = filename;

                        addToScene && App.execute(new AddObjectCommand(points));

                        resolve(points);
                    }, false);
                    reader.readAsArrayBuffer(file);

                    break;
                case 'ply':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as ArrayBuffer;
                        const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');

                        const geometry = new PLYLoader().parse(contents);
                        let object;

                        if (geometry.index !== null) {
                            const material = new THREE.MeshStandardMaterial();

                            object = new THREE.Mesh(geometry, material);
                            object.name = filename;
                        } else {
                            const material = new THREE.PointsMaterial({ size: 0.01 });
                            material.vertexColors = geometry.hasAttribute('color');

                            object = new THREE.Points(geometry, material);
                            object.name = filename;
                        }

                        addToScene && App.execute(new AddObjectCommand(object));

                        resolve(object);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case 'stl':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as ArrayBuffer;

                        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');

                        const geometry = new STLLoader().parse(contents);
                        const material = new THREE.MeshStandardMaterial();

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.name = filename;

                        addToScene && App.execute(new AddObjectCommand(mesh));

                        resolve(mesh);
                    }, false);

                    if (reader.readAsBinaryString !== undefined) {
                        reader.readAsBinaryString(file);
                    } else {
                        reader.readAsArrayBuffer(file);
                    }

                    break;
                case 'svg':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as string;
                        const { SVGLoader } = await import('three/examples/jsm/loaders/SVGLoader.js');

                        const loader = new SVGLoader();
                        const paths = loader.parse(contents).paths;

                        const group = new THREE.Group();
                        group.scale.multiplyScalar(0.1);
                        group.scale.y *= - 1;

                        for (let i = 0; i < paths.length; i++) {
                            const path = paths[i];

                            const material = new THREE.MeshBasicMaterial({
                                color: path.color,
                                depthWrite: false
                            });

                            const shapes = SVGLoader.createShapes(path);

                            for (let j = 0; j < shapes.length; j++) {
                                const shape = shapes[j];

                                const geometry = new THREE.ShapeGeometry(shape);
                                const mesh = new THREE.Mesh(geometry, material);

                                group.add(mesh);
                            }
                        }

                        addToScene && App.execute(new AddObjectCommand(group));

                        resolve(group);
                    }, false);
                    reader.readAsText(file);

                    break;
                case 'usdz':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as ArrayBuffer;

                        const { USDZLoader } = await import('three/examples/jsm/loaders/USDZLoader.js');

                        const group = new USDZLoader().parse(contents);
                        group.name = filename;

                        addToScene && App.execute(new AddObjectCommand(group));

                        resolve(group);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case 'vox':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as ArrayBuffer;
                        const { VOXLoader, VOXMesh } = await import('three/examples/jsm/loaders/VOXLoader.js');

                        const chunks = new VOXLoader().parse(contents);

                        const group = new THREE.Group();
                        group.name = filename;

                        for (let i = 0; i < chunks.length; i++) {
                            const chunk: any = chunks[i];

                            const mesh = new VOXMesh(chunk);
                            // @ts-ignore
                            group.add(mesh);
                        }

                        addToScene && App.execute(new AddObjectCommand(group));

                        resolve(group);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case 'vtk':
                case 'vtp':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as ArrayBuffer;

                        const { VTKLoader } = await import('three/examples/jsm/loaders/VTKLoader.js');
                        //@ts-ignore
                        const geometry = new VTKLoader().parse(contents);
                        const material = new THREE.MeshStandardMaterial();

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.name = filename;

                        addToScene && App.execute(new AddObjectCommand(mesh));

                        resolve(mesh);
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                case 'wrl':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as string;
                        const { VRMLLoader } = await import('three/examples/jsm/loaders/VRMLLoader.js');
                        //@ts-ignore
                        const result = new VRMLLoader().parse(contents);
                        addToScene && App.execute(new SetSceneCommand(result));

                        resolve(result);
                    }, false);
                    reader.readAsText(file);
                    break;
                case 'xyz':
                    reader.addEventListener('load', async function (event) {
                        const contents = event.target?.result as string;

                        const { XYZLoader } = await import('three/examples/jsm/loaders/XYZLoader.js');

                        //@ts-ignore
                        const geometry = new XYZLoader().parse(contents);

                        const material = new THREE.PointsMaterial();
                        //@ts-ignore
                        material.vertexColors = geometry.hasAttribute('color');

                        const points = new THREE.Points(geometry as THREE.BufferGeometry, material);
                        points.name = filename;

                        addToScene && App.execute(new AddObjectCommand(points));

                        resolve(points);
                    }, false);
                    reader.readAsText(file);
                    break;
                case 'zip':
                    reader.addEventListener('load', (event) => {
                        this.handleZIP(event.target?.result, addToScene).then(object => resolve(object as THREE.Object3D)).catch(error => reject(error));
                    }, false);
                    reader.readAsArrayBuffer(file);
                    break;
                default:
                    App.log.warn(`不支持的文件格式: ${extension}`);
                    reject(`不支持的文件格式: ${extension}`);
                    break;
            }
        })
    }

    handleJSON(data, addToScene = true) {
        return new Promise((resolve, reject) => {
            if (data.metadata === undefined) { // 2.0
                data.metadata = { type: 'Geometry' };
            }

            if (data.metadata.type === undefined) { // 3.0
                data.metadata.type = 'Geometry';
            }

            if (data.metadata.formatVersion !== undefined) {
                data.metadata.version = data.metadata.formatVersion;
            }

            switch (data.metadata.type.toLowerCase()) {
                case 'buffergeometry':
                    {
                        const loader = new THREE.BufferGeometryLoader();
                        const result = loader.parse(data);

                        const mesh = new THREE.Mesh(result);

                        addToScene && App.execute(new AddObjectCommand(mesh));

                        resolve(mesh);
                        break;
                    }
                case 'geometry':
                    App.log.warn("Loader:不再支持“几何图形”");
                    reject("Loader:不再支持“几何图形”");
                    break;
                case 'object':
                    {
                        const loader = this.objectLoader;
                        loader.setResourcePath(this.texturePath);

                        loader.parse(data, function (result: any) {
                            if (result.isScene) {
                                addToScene && App.execute(new SetSceneCommand(result));

                                resolve(result);
                            } else {
                                addToScene && App.execute(new AddObjectCommand(result));

                                resolve(result);
                            }
                        });
                        break;
                    }
                case 'app':
                    resolve(App.fromJSON(data));
                    break;
            }
        })
    }

    async handleZIP(contents, addToScene = true) {
        return new Promise(async (resolve, reject) => {
            try {
                const zip = unzipSync(new Uint8Array(contents));

                // Poly
                if (zip['model.obj'] && zip['materials.mtl']) {
                    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');

                    //@ts-ignore
                    const materials = new MTLLoader().parse(strFromU8(zip['materials.mtl']));
                    const object = new OBJLoader().setMaterials(materials).parse(strFromU8(zip['model.obj']));
                    addToScene && App.execute(new AddObjectCommand(object));

                    resolve(object);
                }

                // 20250904： 新增3dtiles支持
                if (zip['tileset.json']) {

                }

                //
                for (const path in zip) {
                    const file = zip[path];

                    const manager = new THREE.LoadingManager();
                    manager.setURLModifier(function (url) {
                        const file = zip[url];

                        if (file) {
                            const blob = new Blob([file.buffer], { type: 'application/octet-stream' });
                            return URL.createObjectURL(blob);
                        }

                        return url;
                    });

                    const extension = path.split('.').pop()?.toLowerCase();
                    switch (extension) {
                        case 'fbx':
                            {
                                const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
                                const loader = new FBXLoader(manager);
                                //@ts-ignore
                                const object = loader.parse(file.buffer);

                                addToScene && App.execute(new AddObjectCommand(object));

                                resolve(object);
                                break;
                            }
                        case 'glb':
                            {
                                const loader = await this.createGLTFLoader();

                                loader.parse(file.buffer, '', (result) => {
                                    const scene = result.scene;

                                    scene.animations.push(...result.animations);
                                    addToScene && App.execute(new AddObjectCommand(scene));

                                    this.disposeGLTFLoaderEffects(loader);

                                    resolve(scene);
                                });
                                break;
                            }
                        case 'gltf':
                            {
                                const loader = await this.createGLTFLoader(manager);

                                loader.parse(strFromU8(file), '', (result) => {
                                    const scene = result.scene;
                                    scene.animations.push(...result.animations);
                                    addToScene && App.execute(new AddObjectCommand(scene));

                                    this.disposeGLTFLoaderEffects(loader);

                                    resolve(scene);
                                });
                                break;
                            }
                    }
                }
            } catch (error) {
                reject(error);
            }
        })
    }

    async createGLTFLoader(manager?: THREE.LoadingManager) {
        const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');

        const loader = new GLTFLoader(manager);
        loader.setDRACOLoader(this.dracoLoader);
        loader.setKTX2Loader(this.ktx2Loader);
        loader.setMeshoptDecoder(MeshoptDecoder);

        return loader;
    }

    disposeGLTFLoaderEffects(loader: any) {
        if (this._dracoLoader && loader.dracoLoader === this._dracoLoader) {
            this._dracoLoader.dispose();
            this._dracoLoader = null;

            loader.dracoLoader = null;
        } else {
            loader.dracoLoader?.dispose();
            loader.dracoLoader = null;
        }

        if (this._ktx2Loader && loader.ktx2Loader === this._ktx2Loader) {
            this._ktx2Loader?.dispose();
            this._ktx2Loader = null;

            loader.ktx2Loader = null;
        } else {
            loader.ktx2Loader.dispose();
            loader.ktx2Loader = null;
        }

        loader.meshoptDecoder = null;
    }

    loadUrlTexture(extension: string, url: string, onload?: (tex: THREE.Texture) => void, onerror?: (err: any) => void) {
        switch (extension) {
            case 'hdr': {
                if (!this.rgbeLoader) this.rgbeLoader = new RGBELoader();

                this.rgbeLoader.setDataType(THREE.HalfFloatType);
                return this.rgbeLoader.load(url, (hdrTexture) => {
                    hdrTexture.wrapS = THREE.RepeatWrapping;
                    hdrTexture.wrapT = THREE.RepeatWrapping;
                    hdrTexture.needsUpdate = true;

                    onload && onload(hdrTexture);
                }, () => { }, (err) => {
                    onerror && onerror(err);
                });
            }
            case 'tga': {
                if (!this.tgaLoader) this.tgaLoader = new TGALoader();

                return this.tgaLoader.load(url, (tagTex) => {
                    tagTex.wrapS = THREE.RepeatWrapping;
                    tagTex.wrapT = THREE.RepeatWrapping;
                    tagTex.needsUpdate = true;

                    onload && onload(tagTex);
                }, () => { }, (err) => {
                    onerror && onerror(err);
                });
            }
            case "exr": {
                return this.exrLoader.load(url, (exrTex) => {
                    exrTex.wrapS = THREE.RepeatWrapping;
                    exrTex.wrapT = THREE.RepeatWrapping;
                    exrTex.needsUpdate = true;

                    onload && onload(exrTex);
                }, () => { }, (err) => {
                    onerror && onerror(err);
                });
            }
            default: {
                if (!this.textureLoader) this.textureLoader = new THREE.TextureLoader();

                return this.textureLoader.load(url, (tex) => {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.needsUpdate = true;

                    onload && onload(tex);
                }, () => { }, (err) => {
                    onerror && onerror(err);
                });
            }
        }
    }
}

const loader = new Loader();
export default loader;
