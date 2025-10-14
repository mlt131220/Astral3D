import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
// import { SSAARenderPass } from "three/examples/jsm/postprocessing/SSAARenderPass.js";
// import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
// import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
// import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
    addTriangleFacingCamera,
    getBSplinePolyline, getBulgeCurvePoints,
    mtextContentAndFormattingToTextAndStyle
} from "./drawUtils";
// @ts-ignore
import { parseDxfMTextContent } from "@dxfom/mtext";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { PickHelper } from "./pickHelper";
import { DrawRect } from "./drawRect";
import log from '#/utils/log/Logger';

let signal, middleObject;
let scene, helpScene, camera, renderer, inputElement, font, data;

// 渲染辉光图层
// let composer, finalComposer;
const BLOOM_SCENE = 10;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
// const DarkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
// const materials = {};

let modules: any = {};

// TODO 当前解析模式会存在 data.blocks 中还有实体但未匹配解析的情况；
// 记录已经解析的 data.blocks,data.entities遍历完成后处理
let parsedBlocks: string[] = [];
// 渲染配置项 && 对比度颜色实体集合
let options = {
    bgColor: 0x000000,
    contrastColor: 0xffffff,
    fontUrl: ''
}, contrastEntity: any = [];

// canvas默认宽高
export const state = {
    width: 500,
    height: 500,
};

/**
 * 离屏canvas和普通canvas共用的绘制图纸方法
 * 优先级：offScreenCanvas > canvas
 */
export function main(d) {
    const { canvas, onComplete } = d;
    signal = d.signal;
    middleObject = d.middleObject;
    state.width = canvas.width;
    state.height = canvas.height;
    inputElement = d.inputElement;
    data = d.data;
    // cad配置项
    options = Object.assign(options, d.options);
    options.bgColor = Number(options.bgColor);
    options.contrastColor = options.bgColor === 0x000000 ? 0xffffff : 0x000000;

    createLineTypeShaders();

    renderer = new THREE.WebGLRenderer({
        canvas,
        powerPreference: "high-performance",
        depth: false,
        antialias: true,
    });
    // 第三个参数false代表不更新canvas dom style
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.setClearColor(options.bgColor, 1);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    // renderer.autoClear = false;

    const loader = new TTFLoader();
    loader.loadAsync(options.fontUrl).then(function (response) {
        font = new Font(response);

        init();

        // OrbitControls mousemove事件中未调用chang事件，所以需要一直渲染
        renderLoop();

        // 添加灯光
        scene.add(new THREE.AmbientLight(0xffffff, 1));

        // 后期通道
        // initComposer();

        const controls = new OrbitControls(camera, inputElement);
        controls.target.x = camera.position.x;
        controls.target.y = camera.position.y;
        controls.target.z = 0;
        controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
        controls.enableRotate = false;
        controls.update();

        // 注册模块
        modules.drawRect = new DrawRect(inputElement, helpScene, camera, signal, middleObject);
        modules.drawRect.setControls(controls);

        const pickPosition = new THREE.Vector2(0, 0);
        modules.pickHelper = new PickHelper(scene, camera, BLOOM_SCENE);
        clearPickPosition();

        function getCanvasRelativePosition(event) {
            const rect = inputElement.getBoundingClientRect();
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            };
        }

        function setPickPosition(event) {
            const pos = getCanvasRelativePosition(event);
            pickPosition.x = (pos.x / state.width) * 2 - 1;
            pickPosition.y = (pos.y / state.height) * - 2 + 1;

            modules.pickHelper.pick(pickPosition);
        }

        function clearPickPosition() {
            //不像鼠标总是有一个位置，如果用户停止触摸屏幕，我们想要停止。现在我们只取一个不太可能取到的值
            pickPosition.x = - 100000;
            pickPosition.y = - 100000;
        }

        inputElement.addEventListener('mousemove', setPickPosition);
        inputElement.addEventListener('mouseout', clearPickPosition);
        inputElement.addEventListener('mouseleave', clearPickPosition);

        inputElement.addEventListener('touchstart', (event) => {
            // 防止窗口滚动
            event.preventDefault();
            setPickPosition(event.touches[0]);
        }, { passive: false });
        inputElement.addEventListener('touchmove', (event) => {
            setPickPosition(event.touches[0]);
        });
        inputElement.addEventListener('touchend', clearPickPosition);

        // 加载完毕
        onComplete && onComplete();

        font = undefined;
        data = undefined;

        resize({ width: inputElement.width, height: inputElement.height });
    });
}

function createLineTypeShaders() {
    let ltype, type;
    if (!data.tables || !data.tables.lineType) return;
    const ltypes = data.tables.lineType.lineTypes;

    for (type in ltypes) {
        ltype = ltypes[type];
        if (!ltype.pattern) continue;
        ltype.material = createDashedLineShader(ltype.pattern);
    }
}

function createDashedLineShader(pattern) {
    let dashedLineShader: any = {},
        totalLength = 0.0;

    for (let i = 0; i < pattern.length; i++) {
        totalLength += Math.abs(pattern[i]);
    }

    dashedLineShader.uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib['common'],
        THREE.UniformsLib['fog'],

        {
            // @ts-ignore
            'pattern': { type: 'fv1', value: pattern },
            // @ts-ignore
            'patternLength': { type: 'f', value: totalLength }
        }
    ]);

    dashedLineShader.vertexShader = [
        'attribute float lineDistance;',

        'varying float vLineDistance;',

        THREE.ShaderChunk['color_pars_vertex'],

        'void main() {',

        THREE.ShaderChunk['color_vertex'],

        'vLineDistance = lineDistance;',

        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

        '}'
    ].join('\n');

    dashedLineShader.fragmentShader = [
        'uniform vec3 diffuse;',
        'uniform float opacity;',

        'uniform float pattern[' + pattern.length + '];',
        'uniform float patternLength;',

        'varying float vLineDistance;',

        THREE.ShaderChunk['color_pars_fragment'],
        THREE.ShaderChunk['fog_pars_fragment'],

        'void main() {',

        'float pos = mod(vLineDistance, patternLength);',

        'for ( int i = 0; i < ' + pattern.length + '; i++ ) {',
        'pos = pos - abs(pattern[i]);',
        'if( pos < 0.0 ) {',
        'if( pattern[i] > 0.0 ) {',
        'gl_FragColor = vec4(1.0, 0.0, 0.0, opacity );',
        'break;',
        '}',
        'discard;',
        '}',

        '}',

        THREE.ShaderChunk['color_fragment'],
        THREE.ShaderChunk['fog_fragment'],

        '}'
    ].join('\n');

    return dashedLineShader;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(options.bgColor);
    helpScene = new THREE.Scene();

    const layersGroupMap: Map<string, THREE.Group> = new Map();
    // 使用layers生成group
    for (let layerName in data.tables.layer.layers) {
        const layer = data.tables.layer.layers[layerName];
        const group = new THREE.Group();
        group.name = layerName;
        group.visible = layer.visible;

        layersGroupMap.set(layerName, group);
        scene.add(group);
    }

    // 通过dxf数据创建场景
    let entity, obj;
    // 生成所有实体
    for (let i = 0; i < data.entities?.length; i++) {
        entity = data.entities[i];

        obj = drawEntity(entity);

        if (obj) {
            if (layersGroupMap.has(entity.layer)) {
                const parent = layersGroupMap.get(entity.layer) || scene;
                parent.add(obj);
                obj.name = `${entity.type}-${entity.handle || 'noHandle'}-${parent.children.length}`
            } else {
                scene.add(obj);
                obj.name = `${entity.type}-${entity.handle || 'noHandle'}-${scene.children.length}`
            }
        }
        obj = null;
    }

    // 2023-9-6:遍历所有剩下的未遍历的块，找出其中 INSERT/DIMENSION 类型的实体，进行解析.(非此类型就算解析位置也不正确)
    // TODO 待删除
    for (let blockName in data.blocks) {
        const block = data.blocks[blockName];

        if (parsedBlocks.includes(blockName) || !block.position || !block.entities) continue;

        for (let j = 0; j < block.entities.length; j++) {
            entity = block.entities[j];
            if (entity.type == "INSERT" || entity.type == "DIMENSION") {
                // TODO 容易栈溢出
                // obj = this.drawEntity(entity);
                //
                // if (obj) {
                //     const bbox = new THREE.Box3().setFromObject(obj);
                //     if (isFinite(bbox.min.x) && (dims.min.x > bbox.min.x)) dims.min.x = bbox.min.x;
                //     if (isFinite(bbox.min.y) && (dims.min.y > bbox.min.y)) dims.min.y = bbox.min.y;
                //     if (isFinite(bbox.min.z) && (dims.min.z > bbox.min.z)) dims.min.z = bbox.min.z;
                //     if (isFinite(bbox.max.x) && (dims.max.x < bbox.max.x)) dims.max.x = bbox.max.x;
                //     if (isFinite(bbox.max.y) && (dims.max.y < bbox.max.y)) dims.max.y = bbox.max.y;
                //     if (isFinite(bbox.max.z) && (dims.max.z < bbox.max.z)) dims.max.z = bbox.max.z;
                //     this.scene.add(obj);
                // }
                // obj = null;
            }
        }
    }

    const aspectRatio = state.width / state.height;
    const dims = new THREE.Box3().setFromObject(scene);
    const upperRightCorner = { x: dims.max.x, y: dims.max.y };
    const lowerLeftCorner = { x: dims.min.x, y: dims.min.y };
    //const lowerLeftCorner = data.header.$EXTMIN; // X、Y 和 Z 图形范围左下角（在 WCS 中）
    //const upperRightCorner = data.header.$EXTMAX; // X、Y 和 Z 图形范围右上角（在 WCS 中）

    // 找出当前的视口范围
    let vp_width = upperRightCorner.x - lowerLeftCorner.x;
    let vp_height = upperRightCorner.y - lowerLeftCorner.y;
    let center = {
        x: vp_width / 2 + lowerLeftCorner.x,
        y: vp_height / 2 + lowerLeftCorner.y
    };
    //let center = data.tables.viewPort.viewPorts[0].ucsOrigin;

    // 将所有对象放入当前的查看器中
    const extentsAspectRatio = Math.abs(vp_width / vp_height);
    if (aspectRatio > extentsAspectRatio) {
        vp_width = vp_height * aspectRatio;
    } else {
        vp_height = vp_width / aspectRatio;
    }

    const viewPort = {
        bottom: -vp_height / 2,
        left: -vp_width / 2,
        top: vp_height / 2,
        right: vp_width / 2,
        center: {
            x: center.x,
            y: center.y
        }
    };

    camera = new THREE.OrthographicCamera(viewPort.left, viewPort.right, viewPort.top, viewPort.bottom, 1, 19);
    camera.position.z = 1;
    camera.position.x = viewPort.center.x;
    camera.position.y = viewPort.center.y;
    camera.userData.viewPort = viewPort;

    // 销毁中间变量
    layersGroupMap.clear();
}

// function initComposer() {
//     const pixelRatio = renderer.getPixelRatio();
//
//     composer = new EffectComposer(renderer);
//     composer.renderToScreen = false;
//     composer.setPixelRatio(pixelRatio)
//
//     let ssaaRenderPass = new SSAARenderPass(scene, camera);
//     ssaaRenderPass.unbiased = false;
//     ssaaRenderPass.sampleLevel = 2;
//     composer.addPass(ssaaRenderPass);
//
//     const bloomPass = new UnrealBloomPass(
//         //参数一：泛光覆盖场景大小，二维向量类型
//         new THREE.Vector2(inputElement.width, inputElement.height),
//         //参数二：bloomStrength 泛光强度，值越大明亮的区域越亮，较暗区域变亮的范围越广
//         1.5,
//         //参数三：bloomRadius 泛光散发半径
//         0,
//         //参数四：bloomThreshold 泛光的光照强度阈值，如果照在物体上的光照强度大于该值就会产生泛光
//         0
//     );
//     composer.addPass(bloomPass);
//
//     const mixPass = new ShaderPass(
//         new THREE.ShaderMaterial({
//             uniforms: {
//                 baseTexture: { value: null },
//                 bloomTexture: { value: composer.renderTarget2.texture }
//             },
//             vertexShader: `
//             varying vec2 vUv;
//                 void main() {
//                 vUv = uv;
//                 gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
//             }
// `,
//             fragmentShader: `
//             uniform sampler2D baseTexture;
//             uniform sampler2D bloomTexture;
//             varying vec2 vUv;
//             void main() {
//                 gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
//             }`,
//             defines: {}
//         }), 'baseTexture'
//     );
//     mixPass.needsSwap = true;
//
//     const outputPass = new OutputPass();
//
//     finalComposer = new EffectComposer(renderer);
//     finalComposer.addPass(ssaaRenderPass);
//     finalComposer.addPass(mixPass);
//     finalComposer.addPass(outputPass);
// }

// 图元选中
export function select({ modelOrName }) {
    let model = modelOrName;
    if (typeof modelOrName === 'string') {
        model = scene.getObjectByProperty('name', modelOrName);
    }

    if (model) {
        modules.pickHelper.select(model);
    }
}

/** ------------------------------------------实体解析部分-------------------------------------------------------- **/
function getColor(entity) {
    let color = options.contrastColor;//默认高对比度颜色
    if (entity.color !== undefined) color = entity.color;
    else if (data.tables && data.tables.layer && data.tables.layer.layers[entity.layer])
        color = data.tables.layer.layers[entity.layer].color;

    // 因为 scene.background = new THREE.Color(options.bgColor)，所以黑色显示时改为白色
    if (color == null || color === 0 || color === options.bgColor) {
        color = options.contrastColor;
    }
    return color;
}

function drawEntity(entity) {
    // 2023-9-6: 仅解析模型空间的实体
    if (entity.inPaperSpace) return null;

    let mesh;
    switch (entity.type) {
        case 'CIRCLE':
        case 'ARC':
            mesh = drawArc(entity);
            break;
        case 'LWPOLYLINE':
        case 'LINE':
        case 'POLYLINE':
            mesh = drawLine(entity);
            break;
        case 'TEXT':
            mesh = drawText(entity);
            break;
        case 'ATTDEF':
            mesh = drawAttdef(entity);
            break;
        case 'ATTRIB':
            mesh = drawAttrib(entity);
            break;
        case 'SOLID':
            mesh = drawSolid(entity);
            break;
        case 'POINT':
            mesh = drawPoint(entity);
            break;
        case 'INSERT':
            mesh = drawBlock(entity);
            break;
        case 'SPLINE':
            mesh = drawSpline(entity);
            break;
        case 'MTEXT':
            // console.log("实体类型 MTEXT:", entity);
            mesh = drawMtext(entity);
            break;
        case 'ELLIPSE':
            mesh = drawEllipse(entity);
            break;
        case "HATCH":
            mesh = drawHatch(entity);
            break;
        case 'DIMENSION':
            const dimTypeEnum = entity.dimensionType & 7;
            if (dimTypeEnum === 0) {
                mesh = drawDimension(entity);
            } else {
                //console.log("不支持的维度类型: " + dimTypeEnum);
            }
            break;
        default:
            log.warn("不支持的实体类型: " + entity.type);
            break;
    }

    if (mesh?.material && mesh.material?.color.getHex() === options.contrastColor) {
        contrastEntity.push(mesh)
    }

    return mesh;
}

function drawArc(entity) {
    let startAngle: number, endAngle: number;
    if (entity.type === 'CIRCLE') {
        startAngle = entity.startAngle || 0;
        endAngle = startAngle + 2 * Math.PI;
    } else {
        startAngle = entity.startAngle;
        endAngle = entity.endAngle;
    }

    //@ts-ignore
    const curve = new THREE.ArcCurve(
        0, 0,
        entity.radius,
        startAngle,
        endAngle);

    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({ color: getColor(entity) });

    const arc = new THREE.Line(geometry, material);
    arc.position.x = entity.center.x;
    arc.position.y = entity.center.y;
    arc.position.z = entity.center.z;

    return arc;
}

function drawLine(entity) {
    let points: THREE.Vector3[] = [];
    let color = getColor(entity);
    let material, lineType, vertex, startPoint, endPoint,
        bulge, i, line;

    if (!entity.vertices) return; //console.log('缺少顶点的实体.');

    // 创建几何
    for (i = 0; i < entity.vertices.length; i++) {
        if (entity.vertices[i].bulge) {
            bulge = entity.vertices[i].bulge;
            startPoint = entity.vertices[i];
            endPoint = i + 1 < entity.vertices.length ? entity.vertices[i + 1] : points[0];

            let bulgePoints = getBulgeCurvePoints(startPoint, endPoint, bulge);

            points.push.apply(points, bulgePoints);
        } else {
            vertex = entity.vertices[i];
            points.push(new THREE.Vector3(vertex.x, vertex.y, 0));
        }

    }
    if (entity.shape) points.push(points[0]);


    // 设置材质
    if (entity.lineType) {
        lineType = data.tables.lineType.lineTypes[entity.lineType];
    }

    if (lineType && lineType.pattern && lineType.pattern.length !== 0) {
        material = new THREE.LineDashedMaterial({ color: color, gapSize: 4, dashSize: 4 });
    } else {
        material = new THREE.LineBasicMaterial({ linewidth: 1, color: color });
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    line = new THREE.Line(geometry, material);
    return line;
}

function drawText(entity) {
    let geometry, material, text;

    if (!font)
        return log.warn('文本不支持没有Three.js字体加载的THREE.FontLoader!');

    if (entity.text == null || entity.text == "") return null;

    if (entity.textHeight == null || entity.textHeight == 0) return null;

    // 当前使用的字体略宽，需要缩小一点
    // xScale: 相对 X 比例因子 — 宽度
    let fontSize = entity.xScale ? entity.xScale * entity.textHeight * 0.73 : entity.textHeight * 0.5;
    geometry = new TextGeometry(entity.text, { font: font, depth: 0, size: fontSize || 100 });

    if (entity.rotation) {
        const zRotation = entity.rotation * Math.PI / 180;
        geometry.rotateZ(zRotation);
    }

    material = new THREE.MeshBasicMaterial({ color: getColor(entity) });

    text = new THREE.Mesh(geometry, material);
    text.position.x = entity.startPoint.x;
    text.position.y = entity.startPoint.y;
    text.position.z = entity.startPoint.z;

    return text;
}

function drawMtext(entity) {
    const color = getColor(entity);

    const textAndControlChars = parseDxfMTextContent(entity.text);

    //Note: 目前只支持应用于所有mtext文本的单一格式
    const content = mtextContentAndFormattingToTextAndStyle(textAndControlChars, entity, color);

    /* 单行文本渲染模式 */
    if (!font)
        return log.warn('文本不支持没有Three.js字体加载的THREE.FontLoader!');

    if (content.text == null || content.text == "") return null;
    if (content.style.textHeight == null || content.style.textHeight == 0) return null;

    const geometry = new TextGeometry(content.text, { font: font, depth: 0, size: content.style.textHeight || 100 });
    if (entity.rotation) {
        const zRotation = entity.rotation * Math.PI / 180;
        geometry.rotateZ(zRotation);
    }
    if (entity.directionVector) {
        const dv = entity.directionVector;
        geometry.rotateZ(new THREE.Vector3(1, 0, 0).angleTo(new THREE.Vector3(dv.x, dv.y, dv.z)));
    }
    const material = new THREE.MeshBasicMaterial({ color });
    const text = new THREE.Mesh(geometry, material);
    text.position.x = entity.position.x;
    text.position.y = entity.position.y;
    text.position.z = entity.position.z;

    return text;


    /* TODO:多行文本渲染,拉近不显示 */
    /*const txt = createTextForScene(content.text, content.style, entity, color,options.fontUrl);
    if (!txt) return null;

    console.log("MText txt:", txt);

    // const group = new THREE.Object3D();
    // group.add(txt);
    return txt;*/
}

// @ts-ignore
function drawAttdef(entity) {
    //console.log("drawAttdef:", entity);
}

// @ts-ignore
function drawAttrib(entity) {
    //console.log("drawAttrib:", entity);
}

function drawSolid(entity) {
    let material, verts,
        geometry = new THREE.BufferGeometry();

    const points = entity.points;
    // verts = geometry.vertices;
    verts = [];
    addTriangleFacingCamera(verts, points[0], points[1], points[2]);
    addTriangleFacingCamera(verts, points[1], points[2], points[3]);

    material = new THREE.MeshBasicMaterial({ color: getColor(entity) });
    geometry.setFromPoints(verts);

    return new THREE.Mesh(geometry, material);
}

function drawPoint(entity) {
    let geometry, material;

    geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.Float32BufferAttribute([entity.position.x, entity.position.y, entity.position.z], 3));

    const color = getColor(entity);

    material = new THREE.PointsMaterial({ size: 0.1, color: new THREE.Color(color) });
    return new THREE.Points(geometry, material);
    // this.scene.add(point);
}

function drawBlock(entity) {
    if (!data.blocks) return;

    let block = data.blocks[entity.name];

    if (!block) return null;

    // 解析过的就存储起来，不再重复解析
    parsedBlocks.push(entity.name);

    if (!block.entities) return null;

    const group = new THREE.Group();

    if (entity.xScale) group.scale.x = entity.xScale;
    if (entity.yScale) group.scale.y = entity.yScale;

    if (entity.rotation) {
        group.rotation.z = entity.rotation * Math.PI / 180;
    }

    if (entity.position) {
        group.position.x = entity.position.x;
        group.position.y = entity.position.y;
        group.position.z = entity.position.z;
    }

    for (let i = 0; i < block.entities.length; i++) {
        const childEntity = drawEntity(block.entities[i]);
        if (childEntity) group.add(childEntity);
    }

    return group;
}

function drawSpline(entity) {
    if (entity.controlPoints === undefined) return null;
    const color = getColor(entity);

    const points = getBSplinePolyline(entity.controlPoints, entity.degreeOfSplineCurve, entity.knotValues, 100, undefined);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ linewidth: 1, color: color });
    return new THREE.Line(geometry, material);
}

function drawEllipse(entity) {
    const color = getColor(entity);

    const xrad = Math.sqrt(Math.pow(entity.majorAxisEndPoint.x, 2) + Math.pow(entity.majorAxisEndPoint.y, 2));
    const yrad = xrad * entity.axisRatio;
    const rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);

    const curve = new THREE.EllipseCurve(
        entity.center.x, entity.center.y,
        xrad, yrad,
        entity.startAngle, entity.endAngle,
        false, // Always counterclockwise
        rotation
    );

    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ linewidth: 1, color: color });

    // 创建要添加到场景中的最后一个对象
    return new THREE.Line(geometry, material);
}

function drawHatch(entity) {
    if (entity.isSolid) return

    // TODO 未实现
}

function drawDimension(entity) {
    if (!data.blocks) return;

    // console.log("drawDimension", entity.block)
    const block = data.blocks[entity.block];

    // 解析过的就存储起来，不再重复解析
    parsedBlocks.push(entity.block);

    if (!block || !block.entities) return null;

    const group = new THREE.Group();
    // if(entity.anchorPoint) {
    //     group.position.x = entity.anchorPoint.x;
    //     group.position.y = entity.anchorPoint.y;
    //     group.position.z = entity.anchorPoint.z;
    // }

    for (let i = 0; i < block.entities.length; i++) {
        const childEntity = drawEntity(block.entities[i]);
        if (childEntity) group.add(childEntity);
    }

    return group;
}

/** ------------------------------------------实体解析结束-------------------------------------------------------- **/

// 设置图层可见性
export function setLayerVisible(data: { layerName: string, visible: boolean }) {
    const group = scene.getObjectByName(data.layerName);
    if (group) group.visible = data.visible;
}

// 调用modules里的方法
export function callModuleMethod(data: { moduleName: string, methodName: string }) {
    const module = modules[data.moduleName];
    if (module && module[data.methodName]) {
        module[data.methodName](data);
    }
}

// 相机复位
export function resetCamera() {
    const viewPort = camera.userData.viewPort;

    if (!viewPort) return;

    camera.left = viewPort.left;
    camera.right = viewPort.right;
    camera.top = viewPort.top;
    camera.bottom = viewPort.bottom;

    camera.position.z = 1;
    camera.position.x = viewPort.center.x;
    camera.position.y = viewPort.center.y;

    modules.drawRect.controls.target.x = camera.position.x;
    modules.drawRect.controls.target.y = camera.position.y;
    modules.drawRect.controls.target.z = 0;
    modules.drawRect.controls.object.zoom = 1;
    modules.drawRect.controls.update();
}

//let start;
export function resize({ width, height }) {
    if (!camera || data) return;

    const hscale = width / state.width;
    const vscale = height / state.height;

    state.width = width;
    state.height = height;

    camera.top = (vscale * camera.top);
    camera.bottom = (vscale * camera.bottom);
    camera.left = (hscale * camera.left);
    camera.right = (hscale * camera.right);

    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
    // composer.setSize(width, height);
    // finalComposer.setSize(width, height);

    render();
}

//
// function darkenNonBloomed(obj) {
//     if (obj.material && bloomLayer.test(obj.layers) === false) {
//         materials[obj.uuid] = obj.material;
//         obj.material = DarkMaterial;
//     }
// }
//
// function restoreMaterial(obj) {
//     if (materials[obj.uuid]) {
//         obj.material = materials[obj.uuid];
//         delete materials[obj.uuid];
//     }
// }

export function render() {
    renderer.autoClear = false;

    // scene.traverse(darkenNonBloomed);
    // composer.render();
    // scene.traverse(restoreMaterial);
    // finalComposer.render();
    renderer.render(scene, camera);
    renderer.render(helpScene, camera);

    renderer.autoClear = true;
}

export function stopRender() {
    renderer.setAnimationLoop(null)
}

export function renderLoop() {
    renderer.setAnimationLoop(render)
}

export function helpRender() {
    renderer.autoClear = false;
    renderer.render(helpScene, camera);
}

export function dispose() {
    data = undefined;
    font = undefined;

    renderer.setAnimationLoop(null)
    renderer?.dispose();
    scene.children.forEach((obj) => {
        scene.remove(obj);
    })
    camera.remove();
    scene.remove();
}

/** ---------------------------- 设置弹窗配置变化 ---------------------------------- */
export function changeClearColor(color: 0x000000 | 0xffffff) {
    options.bgColor = color;
    options.contrastColor = options.bgColor === 0x000000 ? 0xffffff : 0x000000;
    scene.background = new THREE.Color(options.bgColor);

    contrastEntity.forEach(mesh => {
        if (!mesh.material || !mesh.material.color) return;

        mesh.material.color = new THREE.Color(options.contrastColor);
    })
}