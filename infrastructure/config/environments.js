"use strict";
// Environment-specific configurations for CDK deployment
Object.defineProperty(exports, "__esModule", { value: true });
exports.environments = void 0;
exports.getEnvironmentConfig = getEnvironmentConfig;
exports.environments = {
    development: {
        region: 'us-east-1',
        enablePointInTimeRecovery: false,
        removalPolicy: 'DESTROY',
        logRetentionDays: 7,
        apiThrottling: {
            rateLimit: 100,
            burstLimit: 200,
        },
        lambdaConfig: {
            timeout: 30,
            memorySize: 512,
        },
        monitoring: {
            enableXRay: false,
            enableDetailedMetrics: false,
        },
    },
    staging: {
        region: 'us-east-1',
        domainName: 'staging.fintail.me',
        enablePointInTimeRecovery: true,
        removalPolicy: 'RETAIN',
        logRetentionDays: 30,
        apiThrottling: {
            rateLimit: 500,
            burstLimit: 1000,
        },
        lambdaConfig: {
            timeout: 30,
            memorySize: 1024,
            reservedConcurrency: 10,
        },
        monitoring: {
            enableXRay: true,
            enableDetailedMetrics: true,
        },
    },
    production: {
        region: 'us-east-1',
        domainName: 'www.fintail.me',
        enablePointInTimeRecovery: true,
        removalPolicy: 'RETAIN',
        logRetentionDays: 90,
        apiThrottling: {
            rateLimit: 2000,
            burstLimit: 5000,
        },
        lambdaConfig: {
            timeout: 30,
            memorySize: 1024,
            reservedConcurrency: 50,
        },
        monitoring: {
            enableXRay: true,
            enableDetailedMetrics: true,
            alarmEmail: 'alerts@fintail.me',
        },
    },
};
function getEnvironmentConfig(env) {
    const config = exports.environments[env];
    if (!config) {
        throw new Error(`Unknown environment: ${env}. Available environments: ${Object.keys(exports.environments).join(', ')}`);
    }
    return config;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZW52aXJvbm1lbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSx5REFBeUQ7OztBQTBGekQsb0RBTUM7QUF0RVksUUFBQSxZQUFZLEdBQXNDO0lBQzdELFdBQVcsRUFBRTtRQUNYLE1BQU0sRUFBRSxXQUFXO1FBQ25CLHlCQUF5QixFQUFFLEtBQUs7UUFDaEMsYUFBYSxFQUFFLFNBQVM7UUFDeEIsZ0JBQWdCLEVBQUUsQ0FBQztRQUNuQixhQUFhLEVBQUU7WUFDYixTQUFTLEVBQUUsR0FBRztZQUNkLFVBQVUsRUFBRSxHQUFHO1NBQ2hCO1FBQ0QsWUFBWSxFQUFFO1lBQ1osT0FBTyxFQUFFLEVBQUU7WUFDWCxVQUFVLEVBQUUsR0FBRztTQUNoQjtRQUNELFVBQVUsRUFBRTtZQUNWLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLHFCQUFxQixFQUFFLEtBQUs7U0FDN0I7S0FDRjtJQUVELE9BQU8sRUFBRTtRQUNQLE1BQU0sRUFBRSxXQUFXO1FBQ25CLFVBQVUsRUFBRSxvQkFBb0I7UUFDaEMseUJBQXlCLEVBQUUsSUFBSTtRQUMvQixhQUFhLEVBQUUsUUFBUTtRQUN2QixnQkFBZ0IsRUFBRSxFQUFFO1FBQ3BCLGFBQWEsRUFBRTtZQUNiLFNBQVMsRUFBRSxHQUFHO1lBQ2QsVUFBVSxFQUFFLElBQUk7U0FDakI7UUFDRCxZQUFZLEVBQUU7WUFDWixPQUFPLEVBQUUsRUFBRTtZQUNYLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLG1CQUFtQixFQUFFLEVBQUU7U0FDeEI7UUFDRCxVQUFVLEVBQUU7WUFDVixVQUFVLEVBQUUsSUFBSTtZQUNoQixxQkFBcUIsRUFBRSxJQUFJO1NBQzVCO0tBQ0Y7SUFFRCxVQUFVLEVBQUU7UUFDVixNQUFNLEVBQUUsV0FBVztRQUNuQixVQUFVLEVBQUUsZ0JBQWdCO1FBQzVCLHlCQUF5QixFQUFFLElBQUk7UUFDL0IsYUFBYSxFQUFFLFFBQVE7UUFDdkIsZ0JBQWdCLEVBQUUsRUFBRTtRQUNwQixhQUFhLEVBQUU7WUFDYixTQUFTLEVBQUUsSUFBSTtZQUNmLFVBQVUsRUFBRSxJQUFJO1NBQ2pCO1FBQ0QsWUFBWSxFQUFFO1lBQ1osT0FBTyxFQUFFLEVBQUU7WUFDWCxVQUFVLEVBQUUsSUFBSTtZQUNoQixtQkFBbUIsRUFBRSxFQUFFO1NBQ3hCO1FBQ0QsVUFBVSxFQUFFO1lBQ1YsVUFBVSxFQUFFLElBQUk7WUFDaEIscUJBQXFCLEVBQUUsSUFBSTtZQUMzQixVQUFVLEVBQUUsbUJBQW1CO1NBQ2hDO0tBQ0Y7Q0FDRixDQUFDO0FBRUYsU0FBZ0Isb0JBQW9CLENBQUMsR0FBVztJQUM5QyxNQUFNLE1BQU0sR0FBRyxvQkFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLEdBQUcsNkJBQTZCLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbEgsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBFbnZpcm9ubWVudC1zcGVjaWZpYyBjb25maWd1cmF0aW9ucyBmb3IgQ0RLIGRlcGxveW1lbnRcblxuZXhwb3J0IGludGVyZmFjZSBFbnZpcm9ubWVudENvbmZpZyB7XG4gIGFjY291bnQ/OiBzdHJpbmc7XG4gIHJlZ2lvbjogc3RyaW5nO1xuICBkb21haW5OYW1lPzogc3RyaW5nO1xuICBjZXJ0aWZpY2F0ZUFybj86IHN0cmluZztcbiAgZW5hYmxlUG9pbnRJblRpbWVSZWNvdmVyeTogYm9vbGVhbjtcbiAgcmVtb3ZhbFBvbGljeTogJ0RFU1RST1knIHwgJ1JFVEFJTic7XG4gIGxvZ1JldGVudGlvbkRheXM6IG51bWJlcjtcbiAgYXBpVGhyb3R0bGluZzoge1xuICAgIHJhdGVMaW1pdDogbnVtYmVyO1xuICAgIGJ1cnN0TGltaXQ6IG51bWJlcjtcbiAgfTtcbiAgbGFtYmRhQ29uZmlnOiB7XG4gICAgdGltZW91dDogbnVtYmVyO1xuICAgIG1lbW9yeVNpemU6IG51bWJlcjtcbiAgICByZXNlcnZlZENvbmN1cnJlbmN5PzogbnVtYmVyO1xuICB9O1xuICBtb25pdG9yaW5nOiB7XG4gICAgZW5hYmxlWFJheTogYm9vbGVhbjtcbiAgICBlbmFibGVEZXRhaWxlZE1ldHJpY3M6IGJvb2xlYW47XG4gICAgYWxhcm1FbWFpbD86IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudmlyb25tZW50czogUmVjb3JkPHN0cmluZywgRW52aXJvbm1lbnRDb25maWc+ID0ge1xuICBkZXZlbG9wbWVudDoge1xuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgZW5hYmxlUG9pbnRJblRpbWVSZWNvdmVyeTogZmFsc2UsXG4gICAgcmVtb3ZhbFBvbGljeTogJ0RFU1RST1knLFxuICAgIGxvZ1JldGVudGlvbkRheXM6IDcsXG4gICAgYXBpVGhyb3R0bGluZzoge1xuICAgICAgcmF0ZUxpbWl0OiAxMDAsXG4gICAgICBidXJzdExpbWl0OiAyMDAsXG4gICAgfSxcbiAgICBsYW1iZGFDb25maWc6IHtcbiAgICAgIHRpbWVvdXQ6IDMwLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH0sXG4gICAgbW9uaXRvcmluZzoge1xuICAgICAgZW5hYmxlWFJheTogZmFsc2UsXG4gICAgICBlbmFibGVEZXRhaWxlZE1ldHJpY3M6IGZhbHNlLFxuICAgIH0sXG4gIH0sXG4gIFxuICBzdGFnaW5nOiB7XG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBkb21haW5OYW1lOiAnc3RhZ2luZy5maW50YWlsLm1lJyxcbiAgICBlbmFibGVQb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgIHJlbW92YWxQb2xpY3k6ICdSRVRBSU4nLFxuICAgIGxvZ1JldGVudGlvbkRheXM6IDMwLFxuICAgIGFwaVRocm90dGxpbmc6IHtcbiAgICAgIHJhdGVMaW1pdDogNTAwLFxuICAgICAgYnVyc3RMaW1pdDogMTAwMCxcbiAgICB9LFxuICAgIGxhbWJkYUNvbmZpZzoge1xuICAgICAgdGltZW91dDogMzAsXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW5jeTogMTAsXG4gICAgfSxcbiAgICBtb25pdG9yaW5nOiB7XG4gICAgICBlbmFibGVYUmF5OiB0cnVlLFxuICAgICAgZW5hYmxlRGV0YWlsZWRNZXRyaWNzOiB0cnVlLFxuICAgIH0sXG4gIH0sXG4gIFxuICBwcm9kdWN0aW9uOiB7XG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBkb21haW5OYW1lOiAnd3d3LmZpbnRhaWwubWUnLFxuICAgIGVuYWJsZVBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgcmVtb3ZhbFBvbGljeTogJ1JFVEFJTicsXG4gICAgbG9nUmV0ZW50aW9uRGF5czogOTAsXG4gICAgYXBpVGhyb3R0bGluZzoge1xuICAgICAgcmF0ZUxpbWl0OiAyMDAwLFxuICAgICAgYnVyc3RMaW1pdDogNTAwMCxcbiAgICB9LFxuICAgIGxhbWJkYUNvbmZpZzoge1xuICAgICAgdGltZW91dDogMzAsXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW5jeTogNTAsXG4gICAgfSxcbiAgICBtb25pdG9yaW5nOiB7XG4gICAgICBlbmFibGVYUmF5OiB0cnVlLFxuICAgICAgZW5hYmxlRGV0YWlsZWRNZXRyaWNzOiB0cnVlLFxuICAgICAgYWxhcm1FbWFpbDogJ2FsZXJ0c0BmaW50YWlsLm1lJyxcbiAgICB9LFxuICB9LFxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEVudmlyb25tZW50Q29uZmlnKGVudjogc3RyaW5nKTogRW52aXJvbm1lbnRDb25maWcge1xuICBjb25zdCBjb25maWcgPSBlbnZpcm9ubWVudHNbZW52XTtcbiAgaWYgKCFjb25maWcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZW52aXJvbm1lbnQ6ICR7ZW52fS4gQXZhaWxhYmxlIGVudmlyb25tZW50czogJHtPYmplY3Qua2V5cyhlbnZpcm9ubWVudHMpLmpvaW4oJywgJyl9YCk7XG4gIH1cbiAgcmV0dXJuIGNvbmZpZztcbn0iXX0=