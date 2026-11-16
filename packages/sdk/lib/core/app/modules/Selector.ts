import {useDispatchSignal, useAddSignal} from '@/hooks';
import { MeshLambertMaterial } from "three";
import App from "@/core/app/App.ts";
import type { IFCModel } from "web-ifc-three/IFC/components/IFCModel";
import * as THREE from "three";

class Selector {
	public lastIsIFC = false; // 上一次选中的是否是IFC模型
	public lastIFCModelID :number | null = null; // 上一次选中的IFC模型ID
	private ifcModel: IFCModel | null = null;
	private ifcSelectionRequest = 0;
	private preselectMat = new MeshLambertMaterial({
		transparent: true,
		opacity: 0.6,
		color: 0xff88ff,
		depthTest: false,
	});

	constructor() {
		useAddSignal("objectRemoved", (object: THREE.Object3D) => {
			if (this.ifcModel?.isAncestor(object)) this.clearIFCSelection();
		});
		useAddSignal("objectChanged", (object: THREE.Object3D) => {
			if (!object.visible && this.ifcModel?.isAncestor(object)) this.clearIFCSelection();
		});
		useAddSignal("intersectionsDetected", async (intersects: THREE.Intersection[]) => {
			const hit = intersects[0];
			const model = hit?.object as (IFCModel & { isIFC?: boolean }) | undefined;
			const ifc = model?.ifcManager;
			if (!model?.isIFC || hit.faceIndex == null || !ifc) {
				this.select(hit?.object.proxy ?? hit?.object ?? null);
				return;
			}

			this.clearIFCSelection();
			this.ifcModel = model;
			const request = this.ifcSelectionRequest;
			const { geometry, modelID } = model;
			try {
				const id = ifc.getExpressId(geometry, hit.faceIndex);
				const props = await ifc.getItemProperties(modelID, id, true);
				// 属性查询期间可能已经选中其他构件或点击了空白。
				if (request !== this.ifcSelectionRequest) return;

				const subset = ifc.createSubset({
					modelID,
					ids: [id],
					material: this.preselectMat,
					scene: App.scene,
					removePrevious: true,
				});
				// 高亮留在场景根节点供忽略标记过滤，渲染时直接使用源模型的世界矩阵。
				subset.ignore = true;
				subset.matrixWorldAutoUpdate = false;
				subset.matrixWorld = model.matrixWorld;
				subset.layers = model.layers;
				this.lastIFCModelID = modelID;
				this.lastIsIFC = true;
				useDispatchSignal("IFCPropertiesVisible", true, props);
				App.viewer?.render();
			} catch (error) {
				if (request === this.ifcSelectionRequest) {
					this.clearIFCSelection();
					App.log.error("IFC 构件选择失败：" + error);
				}
			}
		});
	}

	private clearIFCSelection() {
		this.ifcSelectionRequest++;
		if (this.lastIFCModelID !== null) {
			this.ifcModel?.ifcManager?.removeSubset(this.lastIFCModelID, this.preselectMat);
			this.lastIFCModelID = null;
		}
		this.ifcModel = null;
		if (this.lastIsIFC) {
			this.lastIsIFC = false;
			useDispatchSignal("IFCPropertiesVisible", false);
			App.viewer?.render();
		}
	}

	select(object:THREE.Object3D | null) {
		this.clearIFCSelection();

		if (App.selected === object) return;

		App.selected = object;

		useDispatchSignal("objectSelected",object, App.locked);
		useDispatchSignal("sceneGraphChanged");
	}

	deselect() {
		this.select(null);
	}
}

export {Selector};
