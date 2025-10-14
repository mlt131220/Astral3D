import { Command } from './Command';
import { useDispatchSignal } from "#/hooks";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param newParent THREE.Object3D
 * @param newBefore THREE.Object3D
 * @constructor
 */
class MoveObjectCommand extends Command {
	public object;
	public oldParent;
	public oldIndex;
	public newParent;
	public newIndex;
	public newBefore;

	constructor(object, newParent, newBefore) {
		super();

		this.type = 'MoveObjectCommand';
		this.name = 'Move object';

		this.object = object;
		this.oldParent = (object !== undefined) ? object.parent : undefined;
		this.oldIndex = (this.oldParent !== undefined) ? this.oldParent.children.indexOf(this.object) : undefined;
		this.newParent = newParent;

		if (newBefore !== undefined) {
			this.newIndex = (newParent !== undefined) ? newParent.children.indexOf(newBefore) : undefined;
		} else {
			this.newIndex = (newParent !== undefined) ? newParent.children.length : undefined;
		}

		if (this.oldParent === this.newParent && this.newIndex > this.oldIndex) {
			this.newIndex--;
		}

		this.newBefore = newBefore;
	}

	execute() {
		this.oldParent.remove(this.object);

		/** 放置到新组下时不改变世界坐标 **/
		// this.newParent.updateWorldMatrix(true, false);
		// const _m1 = new Matrix4();
		// _m1.copy(this.newParent.matrixWorld).invert();
		// if (this.object.parent !== null) {
		//     this.object.parent.updateWorldMatrix( true, false );
		//     _m1.multiply( this.object.parent.matrixWorld );
		// }
		// this.object.applyMatrix4( _m1 );
		/** 放置到新组下时不改变世界坐标 End **/

		const children = this.newParent.children;
		children.splice(this.newIndex, 0, this.object);
		this.object.parent = this.newParent;

		/** 放置到新组下时不改变世界坐标 **/
		// this.object.updateWorldMatrix( false, true );
		/** 放置到新组下时不改变世界坐标 End **/

		this.object.dispatchEvent({ type: 'added' });
		useDispatchSignal("sceneGraphChanged");
	}

	undo() {
		this.newParent.remove(this.object);

		/** 撤销时不改变世界坐标 **/
		// this.oldParent.updateWorldMatrix(true, false);
		// const _m1 = new Matrix4();
		// _m1.copy(this.oldParent.matrixWorld).invert();
		// if (this.object.parent !== null) {
		//     this.object.parent.updateWorldMatrix(true, false);
		//     _m1.multiply( this.object.parent.matrixWorld );
		// }
		// this.object.applyMatrix4(_m1);
		/** 撤销时不改变世界坐标 End **/

		const children = this.oldParent.children;
		children.splice(this.oldIndex, 0, this.object);
		this.object.parent = this.oldParent;

		/** 撤销时不改变世界坐标 **/
		// this.object.updateWorldMatrix( false, true );
		/** 撤销时不改变世界坐标 End **/

		this.object.dispatchEvent({ type: 'added' });
		useDispatchSignal("sceneGraphChanged");
	}

	toJSON() {
		const output = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.newParentUuid = this.newParent.uuid;
		output.oldParentUuid = this.oldParent.uuid;
		output.newIndex = this.newIndex;
		output.oldIndex = this.oldIndex;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.object = App.getObjectByUuid(json.objectUuid);
		this.oldParent = App.getObjectByUuid(json.oldParentUuid);
		if (this.oldParent === undefined) {
			this.oldParent = App.scene;
		}

		this.newParent = App.getObjectByUuid(json.newParentUuid);

		if (this.newParent === undefined) {
			this.newParent = App.scene;
		}

		this.newIndex = json.newIndex;
		this.oldIndex = json.oldIndex;
	}
}

export { MoveObjectCommand };
