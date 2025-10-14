import { useDispatchSignal, useAddSignal } from '#/hooks';
import { MeshLambertMaterial } from "three";
import App from "#/core/app/App.ts";
import Loader from "#/core/loader/Loader.ts";
import * as THREE from "three";

class Selector {
	public lastIsIFC = false; // 上一次选中的是否是IFC模型
	public lastIFCModelID: number | null = null; // 上一次选中的IFC模型ID
	private preselectMat = new MeshLambertMaterial({
		transparent: true,
		opacity: 0.6,
		color: 0xff88ff,
		depthTest: false,
	});

	constructor() {
		// signals
		useAddSignal("intersectionsDetected", async (intersects) => {
			if (this.lastIFCModelID !== null) {
				// 移除之前IFC模型的高亮部分
				Loader._ifcLoader.ifcManager.removeSubset(this.lastIFCModelID, this.preselectMat);
				this.lastIFCModelID = null;
			}

			if (intersects.length > 0) {
				const object = intersects[0].object;

				// ---- 2023/8/10 添加IFC模型检测判断-----
				if (object.isIFC) {
					const index = intersects[0].faceIndex;
					const geometry = object.geometry;
					const ifc = Loader._ifcLoader.ifcManager;
					const id = ifc.getExpressId(geometry, index);

					this.lastIFCModelID = object.modelID;
					const props = await ifc.getItemProperties(this.lastIFCModelID as number, id, true);

					useDispatchSignal("IFCPropertiesVisible", true, props)
					this.lastIsIFC = true;

					// TODO 部件选中
					// 创建子集
					Loader._ifcLoader.ifcManager.createSubset({
						modelID: this.lastIFCModelID as number,
						ids: [id],
						material: this.preselectMat,
						scene: App.scene,
						removePrevious: true,
					});

					return
				}

				if (this.lastIsIFC) {
					useDispatchSignal("IFCPropertiesVisible", false)
					this.lastIsIFC = false;
				}

				if (object.proxy) {
					this.select(object.proxy);
				} else {
					this.select(object);
				}
			} else {
				this.select(null);
			}
		})
	}

	select(object: THREE.Object3D | null) {
		if (App.selected === object) return;

		App.selected = object;

		useDispatchSignal("objectSelected", object, App.locked);
		useDispatchSignal("sceneGraphChanged");
	}

	deselect() {
		this.select(null);
	}
}

export { Selector };
