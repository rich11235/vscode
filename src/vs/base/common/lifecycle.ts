/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { once } from 'vs/base/common/functional';

export const empty: IDisposable = Object.freeze<IDisposable>({
	dispose() { }
});

export interface IDisposable {
	dispose(): void;
}

export function isDisposable<E extends object>(thing: E): thing is E & IDisposable {
	return typeof (<IDisposable><any>thing).dispose === 'function'
		&& (<IDisposable><any>thing).dispose.length === 0;
}

export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(...disposables: T[]): T[];
export function dispose<T extends IDisposable>(disposables: T[]): T[];
export function dispose<T extends IDisposable>(first: T | T[], ...rest: T[]): T | T[] {

	if (Array.isArray(first)) {
		first.forEach(d => d && d.dispose());
		return [];
	} else if (rest.length === 0) {
		if (first) {
			first.dispose();
			return first;
		}
		return undefined;
	} else {
		dispose(first);
		dispose(rest);
		return [];
	}
}

export function combinedDisposable(disposables: IDisposable[]): IDisposable {
	return { dispose: () => dispose(disposables) };
}

export function toDisposable(...fns: (() => void)[]): IDisposable {
	return {
		dispose() {
			for (const fn of fns) {
				fn();
			}
		}
	};
}

export abstract class Disposable implements IDisposable {

	private _toDispose: IDisposable[];

	constructor() {
		this._toDispose = [];
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	protected _register<T extends IDisposable>(t: T): T {
		this._toDispose.push(t);
		return t;
	}
}

export interface IReference<T> extends IDisposable {
	readonly object: T;
}

export abstract class ReferenceCollection<T> {

	private references: { [key: string]: { readonly object: T; counter: number; } } = Object.create(null);

	constructor() { }

	acquire(key: string): IReference<T> {
		let reference = this.references[key];

		if (!reference) {
			reference = this.references[key] = { counter: 0, object: this.createReferencedObject(key) };
		}

		const { object } = reference;
		const dispose = once(() => {
			if (--reference.counter === 0) {
				this.destroyReferencedObject(reference.object);
				delete this.references[key];
			}
		});

		reference.counter++;

		return { object, dispose };
	}

	protected abstract createReferencedObject(key: string): T;
	protected abstract destroyReferencedObject(object: T): void;
}

export class ImmortalReference<T> implements IReference<T> {
	constructor(public object: T) { }
	dispose(): void { /* noop */ }
}
