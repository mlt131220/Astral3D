import { SignalsRegister } from "#/utils/signals/signalRegister";

interface SignalMethods<T = any> {
	add(
		signalName: string,
		listener: (...params: T[]) => void,
		listenerContext?: any,
		priority?: Number
	): void;
	addOnce(
		signalName: string,
		listener: (...params: T[]) => void,
		listenerContext?: any,
		priority?: Number
	): void;
	dispatch(signalName: string, ...params: T[]): void;
	remove(signalName: string, listener: (...params: T[]) => void, context?: any): void;
	removeAll(signalName: string): void;
	setActive(signalName: string, active: boolean): void;
	halt(signalName: string): void;
	dispose(signalName: string): void;
	has(signalName: string, listener: (...params: T[]) => void, context?: any): boolean;
}

export function useSignal(): SignalMethods {
	const add = (
		signalName: string,
		listener: (...params: any) => void,
		listenerContext?: any,
		priority?: Number
	): void => {
		SignalsRegister[signalName].add(listener, listenerContext, priority);
	};

	const addOnce = (
		signalName: string,
		listener: (...params: any) => void,
		listenerContext?: any,
		priority?: number
	): void => {
		SignalsRegister[signalName].addOnce(listener, listenerContext, priority);
	};

	const dispatch = (signalName: string, ...params: any): void => {
		SignalsRegister[signalName].dispatch(...params);
	};

	const remove = (
		signalName: string,
		listener: (...params: any) => void,
		context?: any
	): void => {
		SignalsRegister[signalName].remove(listener, context);
	};

	const removeAll = (signalName: string): void => {
		SignalsRegister[signalName].removeAll();
	};

	const setActive = (signalName: string, active: boolean): void => {
		SignalsRegister[signalName].active = active;
	};

	const halt = (signalName: string): void => {
		SignalsRegister[signalName].halt();
	};

	const dispose = (signalName: string): void => {
		SignalsRegister[signalName].dispose();
	};

	const has = (
		signalName: string,
		listener: (...params: any) => void,
		context?: any
	): boolean => {
		return SignalsRegister[signalName].has(listener, context);
	};

	return { add, addOnce, dispatch, remove, removeAll, setActive, halt, dispose, has };
}

export function useAddSignal(
	signalName: string,
	listener: (...params: any) => void,
	listenerContext?: any,
	priority?: Number
): void {
	SignalsRegister[signalName].add(listener, listenerContext, priority);
}

export function useAddOnceSignal(
	signalName: string,
	listener: (...params: any) => void,
	listenerContext?: any,
	priority?: number
) {
	SignalsRegister[signalName].addOnce(listener, listenerContext, priority);
}

export function useDispatchSignal(signalName: string, ...arg): void {
	SignalsRegister[signalName].dispatch(...arg);
}

export function useRemoveSignal(signalName: string, listener: (...params: any) => void): void {
	SignalsRegister[signalName].remove(listener);
}

export function useSetSignalActive(signalName: string, active: boolean): void {
	SignalsRegister[signalName].active = active;
};
