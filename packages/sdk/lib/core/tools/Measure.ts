import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { useDispatchSignal } from "#/hooks";
import Viewer from "#/core/viewer/Viewer";

export interface MeasureEventMap {
    /**
     * 完成绘制触发
     */
    complete: { object: THREE.Group };
}

export enum MeasureMode {
    Distance = "Distance",
    Area = "Area",
    Angle = "Angle"
}

let pdFn, pmFn, puFn, kdFn;

/**
 * Measure class
 */
class Measure extends THREE.EventDispatcher<MeasureEventMap> {
    static LINE_MATERIAL = new THREE.LineBasicMaterial({
        color: 0xE63C17,
        linewidth: 2,
        opacity: 0.9,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false
    });
    static MESH_MATERIAL = new THREE.MeshBasicMaterial({
        color: 0x87cefa,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false
    });
    static MAX_DISTANCE = 500; //当相交物体的距离太远时，忽略它
    static OBJ_NAME = "object_for_measure";
    static LABEL_NAME = "label_for_measure";

    public isCompleted = true; // 测量操作是否完成
    public isClose = true; // 测量操作是否已关闭(全销毁)
    public mode: MeasureMode;
    protected scene: THREE.Scene;
    protected spriteMaterial?: THREE.SpriteMaterial;
    protected raycaster?: THREE.Raycaster;
    protected mouseMoved = false;
    protected polyline?: THREE.Line; // 用户在测量时绘制的线的当前实例
    protected faces?: THREE.Mesh; // 用于测量面积的当前实例
    protected curve?: THREE.Line; // 用弧线表示角度
    protected tempPointMarker?: THREE.Sprite; // 用于存储临时点
    protected tempLine?: THREE.Line; // 用于存储临时线条，用于在鼠标移动时绘制线条/区域/角度
    protected tempLabel?: CSS2DObject; // 用于在鼠标移动时存储临时标签,只有测量距离时才有
    protected pointArray: THREE.Vector3[] = []; // 存储点
    protected lastClickTime?: number; //保存上次点击时间，以便检测双击事件

    protected viewer: Viewer;
    // 所有测绘内容组
    public measureGroup: THREE.Group;
    // 当前测绘内容组
    protected group: THREE.Group;

    constructor(viewer: Viewer, mode: MeasureMode = MeasureMode.Distance) {
        super();

        this.mode = mode;
        this.scene = viewer.sceneHelpers;
        this.viewer = viewer;

        // 初始化group
        this.measureGroup = new THREE.Group();
        this.measureGroup.name = `measure_group`;

        this.group = new THREE.Group();

        this.scene.add(this.measureGroup);

        this.viewer.modules.dragControl.setMeasureInstance(this);
    }

    get domElement(): HTMLCanvasElement {
        return this.viewer.renderer.domElement;
    }

    get canvas(): HTMLCanvasElement {
        return this.domElement as HTMLCanvasElement;
    }

    addEvent() {
        pdFn = this.mousedown.bind(this);
        this.canvas.addEventListener("pointerdown", pdFn);
        pmFn = this.mousemove.bind(this);
        this.canvas.addEventListener("pointermove", pmFn);
        puFn = this.mouseup.bind(this);
        this.canvas.addEventListener("pointerup", puFn);
        kdFn = this.keydown.bind(this);
        window.addEventListener("keydown", kdFn);
    }

    removeEvent() {
        this.canvas.removeEventListener("pointerdown", pdFn);
        pdFn = undefined;
        this.canvas.removeEventListener("pointermove", pmFn);
        pmFn = undefined;
        this.canvas.removeEventListener("pointerup", puFn);
        puFn = undefined;
        window.removeEventListener("keydown", kdFn);
        kdFn = undefined;
    }

    // 开始测量
    open() {
        this.addEvent();

        if (this.isClose) {
            this.raycaster = new THREE.Raycaster();
        }

        // 重置
        this.group = new THREE.Group();
        this.group.name = `${Measure.OBJ_NAME}_group`;
        this.group.userData = {
            mode: this.mode
        }
        this.measureGroup.add(this.group);

        // 当次绘制点
        this.pointArray = [];

        // 测量距离、面积和角度需要折线
        this.polyline = this.createLine();
        this.group.add(this.polyline as THREE.Object3D);

        if (this.mode === MeasureMode.Area) {
            this.faces = this.createFaces();
            this.group.add(this.faces as THREE.Object3D);
        }
        this.isCompleted = false;
        this.isClose = false;
        this.domElement.style.cursor = "crosshair";

        // 禁用拖拽控制器
        this.viewer.modules.dragControl.dragControls.enabled = false;
    }

    // 重绘
    redraw(point: THREE.Sprite) {
        // 当次绘制点
        this.pointArray = [];

        (point.parent as THREE.Group).children.forEach(child => {
            switch (child.userData.type) {
                case "measure-marker":
                    // 当前点正在操作，不加入
                    if (child.uuid !== point.uuid) {
                        this.pointArray[child.userData.pointIndex] = child.userData.point;
                    } else {
                        this.tempPointMarker = child as THREE.Sprite;
                    }
                    break;
                case "line":
                    this.polyline = child as THREE.Line;
                    this.tempLine = this.createLine();
                    this.scene.add(this.tempLine as THREE.Object3D);
                    break;
                case "faces":
                    this.faces = child as THREE.Mesh;
                    break;
                case "curve":
                    this.curve = child as THREE.Line;
                    break;
            }
        })

        // 重写move事件
        pmFn = this.redrawMousemove.bind(this);
        this.canvas.addEventListener("pointermove", pmFn);

        this.group = point.parent as THREE.Group;
        this.isCompleted = false;
        this.mode = this.group.userData.mode;
    }

    /**
     * 结束测量,清空所有结果
     */
    clear() {
        this.removeEvent();

        this.clearTemp();

        this.measureGroup.children.forEach(g => {
            for (let i = g.children.length - 1; i >= 0; i--) {
                const c = g.children[i];

                if (c.userData.type == "measure-marker") {
                    // 从拖拽控制器移除
                    this.viewer.modules.dragControl.setDragObjects([c], "remove");
                }

                g.remove(c)
            }
        })
        this.measureGroup.remove(...this.measureGroup.children);
        this.polyline = undefined;
        this.faces = undefined;
        this.curve = undefined;

        this.pointArray = [];
        this.raycaster = undefined;

        this.domElement.style.cursor = "";

        this.isClose = true;

        useDispatchSignal("sceneGraphChanged")
    }

    /**
     * 新版本threejs中，BufferGeometry.setFromPoints方法不在支持添加点位置，需要手动设置顶点属性
     */
    setFromPoints(geo: THREE.BufferGeometry, points: THREE.Vector3[]) {
        const position: number[] = [];

        for (let i = 0, l = points.length; i < l; i++) {
            const point = points[i];
            position.push(point.x, point.y, point.z);
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    }

    /**
     * 初始化点标记材料
     */
    initPointMarkerMaterial() {
        const markerTexture = new THREE.TextureLoader().load("/static/images/logo/logo.png");
        this.spriteMaterial = new THREE.SpriteMaterial({
            map: markerTexture,
            depthTest: false,  // 深度测试
            depthWrite: false, // 深度写入
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.9
        });
    }

    // 创建点标记
    createPointMarker(position?: THREE.Vector3): THREE.Sprite {
        if (!this.spriteMaterial) {
            this.initPointMarkerMaterial();
        }
        const p = position;
        const scale = 0.012;
        const obj = new THREE.Sprite(this.spriteMaterial);
        obj.scale.set(scale, scale, scale);
        if (p) {
            obj.position.set(p.x, p.y, p.z);
        }
        obj.name = Measure.OBJ_NAME;

        obj.userData = {
            mode: this.mode,
            type: "measure-marker",
        }
        return obj;
    }

    /**
     * Creates THREE.Line
     */
    private createLine(): THREE.Line {
        const geom = new THREE.BufferGeometry();
        const obj = new THREE.Line(geom, Measure.LINE_MATERIAL);
        obj.frustumCulled = false;
        obj.name = Measure.OBJ_NAME;
        obj.userData = {
            type: "line",
        }
        return obj;
    }

    /**
     * Creates THREE.Mesh
     */
    private createFaces() {
        const geom = new THREE.BufferGeometry();
        const obj = new THREE.Mesh(geom, Measure.MESH_MATERIAL);

        obj.frustumCulled = false;
        obj.name = Measure.OBJ_NAME;
        obj.userData = {
            // 将点存储到userData中
            vertices: [],
            type: "faces",
        }
        return obj;
    }

    // 清除临时信息
    clearTemp() {
        this.tempPointMarker && this.scene.remove(this.tempPointMarker);
        this.tempLine && this.scene.remove(this.tempLine as THREE.Object3D);
        this.tempLabel && this.scene.remove(this.tempLabel);
        this.tempPointMarker = undefined;
        this.tempLine = undefined;
        this.tempLabel = undefined;
    }

    // 完成绘制，不清空结果
    complete() {
        if (this.isCompleted) return;

        useDispatchSignal("sceneGraphChanged")

        let clearPoints = false;
        let clearPolyline = false;
        // 为了测量面积，我们需要制作一个接近的表面，然后添加面积标签
        const count = this.pointArray.length;
        if (this.mode === MeasureMode.Area && this.polyline) {
            if (count > 2) {
                const p0 = this.pointArray[0];
                this.setFromPoints(this.polyline.geometry, [...this.pointArray, p0]);

                // 计算面积
                const area = this.calculateArea(this.pointArray);
                const label = `${this.numberToString(area)} ${this.getUnitString()}`;
                const p = this.getBarycenter(this.pointArray);
                const labelObj = this.createLabel(label);
                labelObj.position.set(p.x, p.y, p.z);
                labelObj.element.innerHTML = label;
                this.group.add(labelObj);
            } else {
                clearPoints = true;
                clearPolyline = true;
            }
        }
        if (this.mode === MeasureMode.Distance) {
            if (count < 2) {
                clearPoints = true;
            }
        }
        if (this.mode === MeasureMode.Angle && this.polyline) {
            if (count >= 3) {
                const p0 = this.pointArray[0];
                const p1 = this.pointArray[1];
                const p2 = this.pointArray[2];
                const dir0 = new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z).normalize();
                const dir1 = this.getAngleBisector(p0, p1, p2);
                const dir2 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize();
                const angle = this.calculateAngle(p0, p1, p2);
                const label = `${this.numberToString(angle)} ${this.getUnitString()}`;
                const distance = Math.min(p0.distanceTo(p1), p2.distanceTo(p1));
                let d = distance * 0.3; // distance from label to p1
                let p = p1.clone().add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d)); // label's position
                const labelObj = this.createLabel(label);
                labelObj.position.set(p.x, p.y, p.z);
                labelObj.element.innerHTML = label;
                this.group.add(labelObj);

                d = distance * 0.2; // 弧到p1的距离
                p = p1.clone().add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d)); // 圆弧中间位置
                const arcP0 = p1.clone().add(new THREE.Vector3(dir0.x * d, dir0.y * d, dir0.z * d));
                const arcP2 = p1.clone().add(new THREE.Vector3(dir2.x * d, dir2.y * d, dir2.z * d));
                this.curve = this.createCurve(arcP0, p, arcP2);
                // 添加弧
                this.group.add(this.curve as THREE.Object3D);
            } else {
                clearPoints = true;
                clearPolyline = true;
            }
        }
        // 无效的情况，清除此次的无用的对象
        if (clearPoints) {
            // 从this.measureGroup移除
            this.measureGroup.remove(this.group);
        }
        if (clearPolyline && this.polyline) {
            this.group.remove(this.polyline as THREE.Object3D);
            this.polyline = undefined;
        }
        this.isCompleted = true;
        this.domElement.style.cursor = "";

        this.clearTemp();

        useDispatchSignal("sceneGraphChanged");

        this.removeEvent();

        // 启用拖拽控制器
        this.viewer.modules.dragControl.dragControls.enabled = true;

        this.dispatchEvent({ type: "complete", object: this.group })
    }

    // 清除当前group label
    clearCurrentLabel() {
        for (let i = this.group.children.length - 1; i >= 0; i--) {
            const c = this.group.children[i];
            if (c.userData.type === "label") {
                this.group.remove(c);
            }
        }
    }

    // 获取按下对应三维位置
    getClosestIntersection(e: MouseEvent) {
        const _point = new THREE.Vector2();
        _point.x = e.offsetX / this.viewer.renderer.domElement.offsetWidth;
        _point.y = e.offsetY / this.viewer.renderer.domElement.offsetHeight;

        const intersects = this.viewer.getIntersects(_point);
        if (intersects && intersects.length > 0) {
            if (intersects.length > 0 && intersects[0].distance < Measure.MAX_DISTANCE) {
                return intersects[0].point;
            }
        }
        return null;
    }

    // 重绘监听鼠标移动
    redrawMousemove(e: MouseEvent) {
        let point = this.getClosestIntersection(e);

        if (!point && this.tempPointMarker) {
            this.tempPointMarker.position.set(this.tempPointMarker.userData.point.x, this.tempPointMarker.userData.point.y, this.tempPointMarker.userData.point.z);
            return;
        }

        if (!point || !this.tempPointMarker) return;

        // 在鼠标移动时绘制临时点
        this.tempPointMarker.position.set(point.x, point.y, point.z);
        this.tempPointMarker.userData.point = point;

        // 当前点的索引
        const cIndex = this.tempPointMarker.userData.pointIndex;

        // 移动时绘制临时线
        if (this.pointArray.length > 0) {
            const line = this.tempLine || this.createLine();
            const geom = line.geometry;
            let startPoint = this.pointArray[cIndex + 1];
            let lastPoint = this.pointArray[cIndex - 1];

            // 如果是面积测量，且当前点是最后一个点或者第一个点
            // 则需要重置其中一个点，才能有两条线拖动效果
            if (this.mode === MeasureMode.Area) {
                if (!lastPoint) {
                    lastPoint = this.pointArray[this.pointArray.length - 1];
                } else if (!startPoint) {
                    startPoint = this.pointArray[0];
                }
            }

            if (startPoint && lastPoint) {
                this.setFromPoints(geom, [lastPoint, point, startPoint]);
            } else {
                this.setFromPoints(geom, [startPoint || lastPoint, point]);
            }
        }
    }

    // 重绘完成
    redrawComplete() {
        if (!this.tempPointMarker) return;

        const point = this.tempPointMarker.userData.point;
        this.pointArray[this.tempPointMarker.userData.pointIndex] = point;
        const count = this.pointArray.length;

        if (this.polyline) {
            this.setFromPoints(this.polyline.geometry, this.pointArray);
            // 如果是距离测量，则清除group中已有的label，再重新创建
            if (this.mode === MeasureMode.Distance && count > 1) {
                this.clearCurrentLabel();
                // 绘制label
                for (let i = 0; i < count - 1; i++) {
                    const p0 = this.pointArray[i];
                    const p1 = this.pointArray[i + 1];
                    if (!p0 || !p1) continue;
                    const dist = p0.distanceTo(p1);
                    const label = `${this.numberToString(dist)} ${this.getUnitString()}`;
                    const position = new THREE.Vector3((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
                    const labelObj = this.createLabel(label);
                    labelObj.position.set(position.x, position.y, position.z);
                    labelObj.element.innerHTML = label;
                    this.group.add(labelObj);
                }
            }
        }

        // 面积测量
        if (this.mode === MeasureMode.Area && this.faces) {
            const geom = this.faces.geometry as THREE.BufferGeometry;
            const vertices = this.faces.userData.vertices;
            // vertices.push(point);
            vertices[this.tempPointMarker.userData.pointIndex] = point;
            this.setFromPoints(geom, vertices);
            const len = vertices.length;
            if (len > 2) {
                const indexArray: number[] = [];
                for (let i = 1; i < len - 1; ++i) {
                    indexArray.push(0, i, i + 1);
                }
                geom.setIndex(indexArray);
                geom.computeVertexNormals();
            }

            // 移除原来的label,新的label会在complete中创建
            this.clearCurrentLabel();
        }

        // 角度测量
        if (this.mode === MeasureMode.Angle && this.curve) {
            // 清除弧跟原来的label 会在complete中创建
            this.group.remove(this.curve as THREE.Object3D);
            this.clearCurrentLabel();
        }

        this.complete();
    }

    mousedown = () => {
        this.mouseMoved = false;
    };

    // 鼠标移动，创建对应的临时点与线
    mousemove = (e: MouseEvent) => {
        if (this.isCompleted) return;

        this.mouseMoved = true;

        const point = this.getClosestIntersection(e);
        if (!point) {
            return;
        }

        // 在鼠标移动时绘制临时点
        if (this.tempPointMarker) {
            this.tempPointMarker.position.set(point.x, point.y, point.z);
        } else {
            this.tempPointMarker = this.createPointMarker(point);
            this.scene.add(this.tempPointMarker);
        }

        // 移动时绘制临时线
        if (this.pointArray.length > 0) {
            const p0 = this.pointArray[this.pointArray.length - 1]; // 获取最后一个点
            const line = this.tempLine || this.createLine();
            const geom = line.geometry;
            const startPoint = this.pointArray[0];
            const lastPoint = this.pointArray[this.pointArray.length - 1];
            if (this.mode === MeasureMode.Area) {
                this.setFromPoints(geom, [lastPoint, point, startPoint]);
            } else {
                this.setFromPoints(geom, [lastPoint, point]);
            }
            if (this.mode === MeasureMode.Distance) {
                const dist = p0.distanceTo(point);
                const label = `${this.numberToString(dist)} ${this.getUnitString()}`;
                const position = new THREE.Vector3((point.x + p0.x) / 2, (point.y + p0.y) / 2, (point.z + p0.z) / 2);
                this.addOrUpdateTempLabel(label, position);
            }
            // tempLine 只需添加到场景一次
            if (!this.tempLine) {
                this.scene.add(line as THREE.Object3D);
                this.tempLine = line;
            }
        }

        useDispatchSignal("sceneGraphChanged")
    };

    mouseup = (e: MouseEvent) => {
        // 如果mouseMoved是true，那么它可能在移动，而不是点击
        if (!this.mouseMoved) {
            // 右键点击表示完成绘图操作
            if (e.button === 2) {
                this.complete();
            } else if (e.button === 0) { // 左键点击表示添加点
                this.onMouseClicked(e);
            }
        }
    };

    onMouseClicked = (e: MouseEvent) => {
        if (!this.raycaster || !this.viewer.camera || !this.scene || this.isCompleted) {
            return;
        }

        const point = this.getClosestIntersection(e);
        if (!point) {
            return;
        }

        // 双击触发两次点击事件，我们需要避免这里的第二次点击
        const now = Date.now();
        if (this.lastClickTime && (now - this.lastClickTime < 100)) return;

        this.lastClickTime = now;

        this.pointArray.push(point);
        const count = this.pointArray.length;
        const marker = this.createPointMarker(point);
        marker.userData.point = point;
        marker.userData.pointIndex = count - 1;
        this.group.add(marker);
        // 把点加入拖拽控制器
        this.viewer.modules.dragControl.setDragObjects([marker], "push");

        if (this.polyline) {
            this.setFromPoints(this.polyline.geometry, this.pointArray);
            if (this.tempLabel && count > 1) {
                const p0 = this.pointArray[count - 2];
                this.tempLabel.position.set((p0.x + point.x) / 2, (p0.y + point.y) / 2, (p0.z + point.z) / 2);
                this.group.add(this.tempLabel);

                // 创建距离测量线时，此处的 临时label 将作为正式的使用，不在this.clearTemp()中清除，故置为undefined
                this.tempLabel = undefined;
            }
        }
        if (this.mode === MeasureMode.Area && this.faces) {
            const geom = this.faces.geometry as THREE.BufferGeometry;
            const vertices = this.faces.userData.vertices;
            vertices.push(point);
            this.setFromPoints(geom, vertices);
            const len = vertices.length;
            if (len > 2) {
                const indexArray: number[] = [];
                for (let i = 1; i < len - 1; ++i) {
                    indexArray.push(0, i, i + 1);
                }
                geom.setIndex(indexArray);
                geom.computeVertexNormals();

                this.clearCurrentLabel();
                const p0 = this.pointArray[0];
                this.setFromPoints(geom, [...this.pointArray, p0]);
                // 计算面积
                const area = this.calculateArea(this.pointArray);
                const label = `${this.numberToString(area)} ${this.getUnitString()}`;
                const p = this.getBarycenter(this.pointArray);
                const labelObj = this.createLabel(label);
                labelObj.position.set(p.x, p.y, p.z);
                labelObj.element.innerHTML = label;
                this.group.add(labelObj);
            }
        }
        // 创建角度测量时，三个点完成
        if (this.mode === MeasureMode.Angle && this.pointArray.length % 3 === 0) {
            this.complete();
        }

        useDispatchSignal("sceneGraphChanged");
    };

    keydown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            this.complete();
        }
    };

    /**
     * 添加或更新临时标签和位置
     */
    addOrUpdateTempLabel(label: string, position: THREE.Vector3) {
        if (!this.tempLabel) {
            this.tempLabel = this.createLabel(label);
            this.scene.add(this.tempLabel);
        }
        this.tempLabel.position.set(position.x, position.y, position.z);
        this.tempLabel.element.innerHTML = label;
    }

    /**
     * 创建标签
     */
    createLabel(text: string): CSS2DObject {
        const div = document.createElement("div");
        div.className = 'css2dObjectLabel';
        div.innerHTML = text;
        div.style.padding = "5px 8px";
        div.style.color = "#fff";
        div.style.fontSize = "14px";
        div.style.position = "absolute";
        div.style.backgroundColor = "rgba(25, 25, 25, 0.3)";
        div.style.borderRadius = "12px";
        div.style.top = "0px";
        div.style.left = "0px";
        // div.style.pointerEvents = 'none' //避免HTML元素影响场景的鼠标事件
        const obj = new CSS2DObject(div);
        obj.name = Measure.LABEL_NAME;
        obj.userData = {
            type: "label"
        }
        return obj;
    }

    /**
     * 创建圆弧曲线以表示角度
     */
    createCurve(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) {
        const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
        const points = curve.getPoints(4);
        const geometry = new THREE.BufferGeometry();
        this.setFromPoints(geometry, points)
        const obj = new THREE.Line(geometry, Measure.LINE_MATERIAL);
        obj.name = Measure.OBJ_NAME;
        obj.userData = {
            type: "curve"
        }
        return obj;
    }

    /**
     * 计算区域
     * TODO: 对于凹多边形，数值不对，需要修正
     * @param points
     */
    calculateArea(points: THREE.Vector3[]) {
        let area = 0;
        for (let i = 0, j = 1, k = 2; k < points.length; j++, k++) {
            const a = points[i].distanceTo(points[j]);
            const b = points[j].distanceTo(points[k]);
            const c = points[k].distanceTo(points[i]);
            const p = (a + b + c) / 2;
            area += Math.sqrt(p * (p - a) * (p - b) * (p - c));
        }
        return area;
    }

    /**
     * 以度表示两条直线的夹角
     */
    calculateAngle(startPoint: THREE.Vector3, middlePoint: THREE.Vector3, endPoint: THREE.Vector3) {
        const p0 = startPoint;
        const p1 = middlePoint;
        const p2 = endPoint;
        const dir0 = new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z);
        const dir1 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        const angle = dir0.angleTo(dir1);
        return angle * 180 / Math.PI; // convert to degree
    }

    /**
     * 获取两条线的角平分线
     */
    getAngleBisector(startPoint: THREE.Vector3, middlePoint: THREE.Vector3, endPoint: THREE.Vector3): THREE.Vector3 {
        const p0 = startPoint;
        const p1 = middlePoint;
        const p2 = endPoint;
        const dir0 = new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z).normalize();
        const dir2 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize();
        return new THREE.Vector3(dir0.x + dir2.x, dir0.y + dir2.y, dir0.z + dir2.z).normalize(); // the middle direction between dir0 and dir2
    }

    /**
     * 得到点的重心
     */
    getBarycenter(points: THREE.Vector3[]): THREE.Vector3 {
        const l = points.length;
        let x = 0;
        let y = 0;
        let z = 0;
        points.forEach(p => {
            x += p.x;
            y += p.y;
            z += p.z
        });
        return new THREE.Vector3(x / l, y / l, z / l);
    }

    /**
     * 获取距离、面积或角度的单位字符串
     */
    getUnitString() {
        if (this.mode === MeasureMode.Distance) return "m";
        if (this.mode === MeasureMode.Area) return "m²";
        if (this.mode === MeasureMode.Angle) return "°";
        return "";
    }

    /**
     * 将数字转换为具有适当分数数字的字符串
     */
    numberToString(num: number) {
        if (num < 0.0001) {
            return num.toString();
        }
        let fractionDigits = 2;
        if (num < 0.01) {
            fractionDigits = 4;
        } else if (num < 0.1) {
            fractionDigits = 3;
        }
        return num.toFixed(fractionDigits);
    }

    dispose(): void {
        this.clear();
    }
}

export { Measure };