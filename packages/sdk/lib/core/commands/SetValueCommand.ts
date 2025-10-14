import { Command } from './Command';
import { useDispatchSignal } from "#/hooks";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param attributeName string
 * @param newValue number, string, boolean or object
 * @constructor
 */
class SetValueCommand extends Command {
	public object;
	public attributeName;
	public oldValue;
	public newValue;

	constructor(object, attributeName, newValue) {

		super();

		this.type = 'SetValueCommand';
		this.name = `Set ${attributeName}`;
		this.updatable = true;

		this.object = object;
		this.attributeName = attributeName;
		this.oldValue = (object !== undefined) ? object[attributeName] : undefined;
		this.newValue = newValue;
	}

	execute() {
		this.object[this.attributeName] = this.newValue;
		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("sceneGraphChanged");
	}

	undo() {
		this.object[this.attributeName] = this.oldValue;
		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("sceneGraphChanged");
	}

	update(cmd) {
		this.newValue = cmd.newValue;
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

		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.object = App.getObjectByUuid(json.objectUuid);
	}
}

export { SetValueCommand };
