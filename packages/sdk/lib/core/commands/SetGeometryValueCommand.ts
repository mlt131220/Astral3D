import { Command } from './Command';
import { useDispatchSignal } from "#/hooks/useSignal";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param attributeName string
 * @param newValue number, string, boolean or object
 * @constructor
 */
class SetGeometryValueCommand extends Command {
	public object;
	public attributeName;
	public oldValue;
	public newValue;

	constructor(object, attributeName, newValue) {
		super();

		this.type = 'SetGeometryValueCommand';
		this.name = `Set geometry.${attributeName}`;

		this.object = object;
		this.attributeName = attributeName;
		this.oldValue = (object !== undefined) ? object.geometry[attributeName] : undefined;
		this.newValue = newValue;

	}

	execute() {
		this.object.geometry[this.attributeName] = this.newValue;
		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("geometryChanged", this.object);
		useDispatchSignal("sceneGraphChanged");
	}

	undo() {
		this.object.geometry[this.attributeName] = this.oldValue;
		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("geometryChanged", this.object);
		useDispatchSignal("sceneGraphChanged");
	}

	toJSON() {
		const output = super.toJSON();
		output.objectUuid = this.object.uuid;
		output.attributeName = this.attributeName;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.object = App.getObjectByUuid(json.objectUuid);
		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
	}
}

export { SetGeometryValueCommand };
