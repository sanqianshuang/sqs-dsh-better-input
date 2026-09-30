/**
 * The Host-side Typert manifest. It must mirror `TYPERT_REMOTE` (the client
 * face) method-for-method; a mismatch is rejected at the boundary.
 */
export declare const TYPERT: {
    package: string;
    face: string;
    schemas: never[];
    invocations: ({
        id: string;
        service: string;
        namespace: string;
        method: string;
        invocation: {
            kind: string;
        };
        parameters: {
            name: string;
            wire: string;
            source: string;
            codec: {
                mode: "strict";
                typeSymbol: string;
                create: () => {
                    parse(value: unknown): unknown;
                };
            };
        }[];
        cancellation: {
            parameter: string;
        };
        result: {
            mode: "strict";
            typeSymbol: string;
            create: () => {
                parse(value: unknown): unknown;
            };
        };
    } | {
        id: string;
        service: string;
        namespace: string;
        method: string;
        invocation: {
            kind: string;
        };
        parameters: {
            name: string;
            wire: string;
            source: string;
            codec: {
                mode: "strict";
                typeSymbol: string;
                create: () => {
                    parse(value: unknown): unknown;
                };
            };
        }[];
        result: {
            mode: "strict";
            typeSymbol: string;
            create: () => {
                parse(value: unknown): unknown;
            };
        };
        cancellation?: undefined;
    })[];
    /**
     * The typed-registry model block.
     *
     * This is REQUIRED by dsh's typert loader, not optional metadata:
     * `validateTypertManifest` reads `manifest.model` and demands an object whose
     * `services` / `events` / `objects` are arrays (see `dsh-typert-loader/lib/index.js`
     * :89-92, and `requireObject` at :119-122 — unchanged in 0.2.0-rc.2). A missing
     * `model` fails the whole
     * entry with "typert-loader: <pkg> TYPERT.model must be an object", the entry
     * never activates, and the browser web boot then refuses to render the UI.
     *
     * Removing the file-input / OCR feature dropped this block by accident in
     * 0.1.0-0.1.2 (`convertFile` and `ConvertFileResult` were the only intended
     * deletions). Keep `model` in sync with `invocations` above and with the
     * service surface in `polish/service.ts`.
     */
    model: {
        services: {
            description: string;
            summary: string;
            tags: never[];
            jsDoc: string;
            key: string;
            exportName: string;
            members: {
                kind: string;
                name: string;
                signature: string;
                summary: string;
                jsDoc: string;
            }[];
            types: {
                name: string;
                declaration: string;
            }[];
        }[];
        events: never[];
        objects: never[];
    };
};
export default TYPERT;
