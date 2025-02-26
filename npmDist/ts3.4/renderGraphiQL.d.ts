import { FormattedExecutionResult } from 'graphql';
export interface GraphiQLData {
    query?: string | null;
    variables?: {
        readonly [name: string]: unknown;
    } | null;
    operationName?: string | null;
    result?: FormattedExecutionResult;
}
export interface GraphiQLOptions {
    /**
     * An optional GraphQL string to use when no query is provided and no stored
     * query exists from a previous session.  If undefined is provided, GraphiQL
     * will use its own default query.
     */
    defaultQuery?: string;
    /**
     * An optional boolean which enables the header editor when true.
     * Defaults to false.
     */
    headerEditorEnabled?: boolean;
    /**
     * An optional boolean which enables headers to be saved to local
     * storage when true.
     * Defaults to false.
     */
    shouldPersistHeaders?: boolean;
    /**
     * A websocket endpoint for subscription
     */
    subscriptionEndpoint?: string;
    /**
     * websocket client option for subscription, defaults to v0
     * v0: subscriptions-transport-ws
     * v1: graphql-ws
     */
    websocketClient?: string;
}
/**
 * When express-graphql receives a request which does not Accept JSON, but does
 * Accept HTML, it may present GraphiQL, the in-browser GraphQL explorer IDE.
 *
 * When shown, it will be pre-populated with the result of having executed the
 * requested query.
 */
export declare function renderGraphiQL(data: GraphiQLData, options?: GraphiQLOptions): string;
