import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client';
import type { AboutInfoWire, BetterInputSettingsPatch, BetterInputSettingsView, PolishRoute, ReasoningEffortInfo, SpeechStatusWire, SpeechTranscriptWire, TemplateInputWire, TemplateWire, UpdateCheckResultWire } from './remote-contract.js';
export type BetterInputRemote = ClientRemote['betterInput'];
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespace$betterInput {
        getSettings: () => Promise<RemoteResult<BetterInputSettingsView>>;
        updateSettings: (patch: BetterInputSettingsPatch, signal?: AbortSignal) => Promise<RemoteResult<BetterInputSettingsView>>;
        listRoutes: () => Promise<RemoteResult<PolishRoute[]>>;
        resolveModelEfforts: (provider: string, model: string) => Promise<RemoteResult<{
            efforts: readonly ReasoningEffortInfo[];
            defaultEffort?: string;
        }>>;
        getAbout: () => Promise<RemoteResult<AboutInfoWire>>;
        checkForUpdate: (signal?: AbortSignal) => Promise<RemoteResult<UpdateCheckResultWire>>;
        polish: (transcript: string, provider: string, model: string, effort: string, signal?: AbortSignal) => Promise<RemoteResult<string>>;
        optimize: (text: string, provider: string, model: string, context: string, effort: string, signal?: AbortSignal) => Promise<RemoteResult<string>>;
        templatesList: () => Promise<RemoteResult<{
            templates: TemplateWire[];
        }>>;
        templatesSave: (template: TemplateInputWire, signal?: AbortSignal) => Promise<RemoteResult<{
            template: TemplateWire;
        }>>;
        templatesRemove: (id: string, signal?: AbortSignal) => Promise<RemoteResult<{
            removed: boolean;
        }>>;
        speechStatus: () => Promise<RemoteResult<SpeechStatusWire>>;
        speechPrepare: (providerId: string) => Promise<RemoteResult<SpeechStatusWire>>;
        transcribeSpeech: (audioBase64: string, language: string, signal?: AbortSignal) => Promise<RemoteResult<SpeechTranscriptWire>>;
    }
    interface TypertRemoteMap {
        'betterInput/getSettings': () => Promise<RemoteResult<BetterInputSettingsView>>;
        'betterInput/updateSettings': (patch: BetterInputSettingsPatch, signal?: AbortSignal) => Promise<RemoteResult<BetterInputSettingsView>>;
        'betterInput/listRoutes': () => Promise<RemoteResult<PolishRoute[]>>;
        'betterInput/resolveModelEfforts': (provider: string, model: string) => Promise<RemoteResult<{
            efforts: readonly ReasoningEffortInfo[];
            defaultEffort?: string;
        }>>;
        'betterInput/getAbout': () => Promise<RemoteResult<AboutInfoWire>>;
        'betterInput/checkForUpdate': (signal?: AbortSignal) => Promise<RemoteResult<UpdateCheckResultWire>>;
        'betterInput/polish': (transcript: string, provider: string, model: string, effort: string, signal?: AbortSignal) => Promise<RemoteResult<string>>;
        'betterInput/optimize': (text: string, provider: string, model: string, context: string, effort: string, signal?: AbortSignal) => Promise<RemoteResult<string>>;
        'betterInput/templatesList': () => Promise<RemoteResult<{
            templates: TemplateWire[];
        }>>;
        'betterInput/templatesSave': (template: TemplateInputWire, signal?: AbortSignal) => Promise<RemoteResult<{
            template: TemplateWire;
        }>>;
        'betterInput/templatesRemove': (id: string, signal?: AbortSignal) => Promise<RemoteResult<{
            removed: boolean;
        }>>;
        'betterInput/speechStatus': () => Promise<RemoteResult<SpeechStatusWire>>;
        'betterInput/speechPrepare': (providerId: string) => Promise<RemoteResult<SpeechStatusWire>>;
        'betterInput/transcribeSpeech': (audioBase64: string, language: string, signal?: AbortSignal) => Promise<RemoteResult<SpeechTranscriptWire>>;
    }
    interface TypertRemoteNamespaceMap {
        betterInput: TypertRemoteNamespace$betterInput;
    }
}
/** The client-face Typert manifest; mirrors the Host face in `typert.ts`. */
export declare const TYPERT_REMOTE: TypertRemoteContribution;
export default TYPERT_REMOTE;
