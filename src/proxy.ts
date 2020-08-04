import { ConfigurationOptions } from 'aws-sdk/lib/config';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import * as Aws from 'aws-sdk/clients/all';
import { NextToken } from 'aws-sdk/clients/cloudformation';
import { builder, IBuilder } from 'tombok';

import {
    BaseDto,
    BaseResourceHandlerRequest,
    BaseModel,
    Dict,
    HandlerErrorCode,
    OperationStatus,
} from './interface';
import { Exclude, Expose } from 'class-transformer';

type ClientMap = typeof Aws;
type Client = InstanceType<ClientMap[keyof ClientMap]>;

export class SessionProxy {
    constructor(private options: ConfigurationOptions) {}

    public client(name: keyof ClientMap, options?: ConfigurationOptions): Client {
        const clients: { [K in keyof ClientMap]: ClientMap[K] } = Aws;
        const service: Client = new clients[name]({
            ...this.options,
            ...options,
        });
        return service;
    }

    public static getSession(
        credentials?: CredentialsOptions,
        region?: string
    ): SessionProxy | null {
        if (!credentials) {
            return null;
        }
        return new SessionProxy({
            credentials,
            region,
        });
    }
}

@builder
export class ProgressEvent<R extends BaseModel = BaseModel, T = Dict> extends BaseDto {
    /**
     * The status indicates whether the handler has reached a terminal state or is
     * still computing and requires more time to complete
     */
    @Expose() status: OperationStatus;

    /**
     * If OperationStatus is FAILED or IN_PROGRESS, an error code should be provided
     */
    @Expose() errorCode?: HandlerErrorCode;

    /**
     * The handler can (and should) specify a contextual information message which
     * can be shown to callers to indicate the nature of a progress transition or
     * callback delay; for example a message indicating "propagating to edge"
     */
    @Expose() message = '';

    /**
     * The callback context is an arbitrary datum which the handler can return in an
     * IN_PROGRESS event to allow the passing through of additional state or
     * metadata between subsequent retries; for example to pass through a Resource
     * identifier which can be used to continue polling for stabilization
     */
    @Expose() callbackContext?: T;

    /**
     * A callback will be scheduled with an initial delay of no less than the number
     * of seconds specified in the progress event.
     */
    @Expose() callbackDelaySeconds = 0;

    /**
     * The output resource instance populated by a READ for synchronous results and
     * by CREATE/UPDATE/DELETE for final response validation/confirmation
     */
    @Expose() resourceModel?: R;

    /**
     * The output resource instances populated by a LIST for synchronous results
     */
    @Expose() resourceModels?: Array<R>;

    /**
     * The token used to request additional pages of resources for a LIST operation
     */
    @Expose() nextToken?: NextToken;

    constructor(partial?: Partial<ProgressEvent>) {
        super();
        if (partial) {
            Object.assign(this, partial);
        }
    }

    // TODO: remove workaround when decorator mutation implemented: https://github.com/microsoft/TypeScript/issues/4881
    @Exclude()
    public static builder(template?: Partial<ProgressEvent>): IBuilder<ProgressEvent> {
        return null;
    }

    /**
     * Convenience method for constructing FAILED response
     */
    @Exclude()
    public static failed(errorCode: HandlerErrorCode, message: string): ProgressEvent {
        const event = ProgressEvent.builder()
            .status(OperationStatus.Failed)
            .errorCode(errorCode)
            .message(message)
            .build();
        return event;
    }

    /**
     * Convenience method for constructing IN_PROGRESS response
     */
    @Exclude()
    public static progress(model?: any, ctx?: any): ProgressEvent {
        const progress = ProgressEvent.builder().status(OperationStatus.InProgress);
        if (ctx) {
            progress.callbackContext(ctx);
        }
        if (model) {
            progress.resourceModel(model);
        }
        const event = progress.build();
        return event;
    }

    @Exclude()
    /**
     * Convenience method for constructing a SUCCESS response
     */
    public static success(model?: any, ctx?: any): ProgressEvent {
        const event = ProgressEvent.progress(model, ctx);
        event.status = OperationStatus.Success;
        return event;
    }
}

/**
 * This interface describes the request object for the provisioning request
 * passed to the implementor. It is transformed from an instance of
 * HandlerRequest by the LambdaWrapper to only items of concern
 *
 * @param <T> Type of resource model being provisioned
 */
export class ResourceHandlerRequest<
    T extends BaseModel
> extends BaseResourceHandlerRequest<T> {
    @Expose() clientRequestToken: string;
    @Expose() desiredResourceState: T;
    @Expose() previousResourceState: T;
    @Expose() desiredResourceTags: Dict<string>;
    @Expose() systemTags: Dict<string>;
    @Expose() awsAccountId: string;
    @Expose() awsPartition: string;
    @Expose() logicalResourceIdentifier: string;
    @Expose() nextToken: string;
    @Expose() region: string;
}
