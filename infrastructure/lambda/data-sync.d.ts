import { EventBridgeEvent, Context } from 'aws-lambda';
interface SyncSummary {
    totalCompanies: number;
    successfulUpdates: number;
    failedUpdates: number;
    totalRecordsUpdated: number;
    averageQualityScore: number;
    totalProcessingTime: number;
    errors: string[];
}
export declare const handler: (event: EventBridgeEvent<"Scheduled Event", any>, context: Context) => Promise<SyncSummary>;
export {};
