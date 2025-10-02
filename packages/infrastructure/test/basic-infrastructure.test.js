"use strict";
/**
 * Basic Infrastructure Tests
 * Simple tests to verify CDK stack compilation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const aws_cdk_lib_1 = require("aws-cdk-lib");
const assertions_1 = require("aws-cdk-lib/assertions");
const photobooth_stack_1 = require("../src/stacks/photobooth-stack");
const environments_1 = require("../src/config/environments");
describe('Basic Infrastructure Tests', () => {
    test('CDK stack compiles without errors', () => {
        const app = new aws_cdk_lib_1.App();
        // Create stack with test configuration
        const stack = new photobooth_stack_1.PhotoboothStack(app, 'TestStack', {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
            environmentConfig: environments_1.environments.dev,
        });
        // Should not throw
        const template = assertions_1.Template.fromStack(stack);
        // Basic assertions
        expect(template).toBeDefined();
        expect(stack).toBeDefined();
    });
    test('Stack creates S3 bucket', () => {
        const app = new aws_cdk_lib_1.App();
        const stack = new photobooth_stack_1.PhotoboothStack(app, 'TestStack', {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
            environmentConfig: environments_1.environments.dev,
        });
        const template = assertions_1.Template.fromStack(stack);
        // Should have at least one S3 bucket
        template.resourceCountIs('AWS::S3::Bucket', 1);
    });
    test('Stack creates DynamoDB tables', () => {
        const app = new aws_cdk_lib_1.App();
        const stack = new photobooth_stack_1.PhotoboothStack(app, 'TestStack', {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
            environmentConfig: environments_1.environments.dev,
        });
        const template = assertions_1.Template.fromStack(stack);
        // Should have DynamoDB tables
        template.resourceCountIs('AWS::DynamoDB::Table', 2);
    });
    test('Stack creates ECS resources', () => {
        const app = new aws_cdk_lib_1.App();
        const stack = new photobooth_stack_1.PhotoboothStack(app, 'TestStack', {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
            environmentConfig: environments_1.environments.dev,
        });
        const template = assertions_1.Template.fromStack(stack);
        // Should have ECS cluster
        template.resourceCountIs('AWS::ECS::Cluster', 1);
        // Should have ECS service
        template.resourceCountIs('AWS::ECS::Service', 1);
        // Should have task definition
        template.resourceCountIs('AWS::ECS::TaskDefinition', 1);
    });
    test('Stack creates load balancer', () => {
        const app = new aws_cdk_lib_1.App();
        const stack = new photobooth_stack_1.PhotoboothStack(app, 'TestStack', {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
            environmentConfig: environments_1.environments.dev,
        });
        const template = assertions_1.Template.fromStack(stack);
        // Should have application load balancer
        template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    });
    test('Stack synthesizes successfully', () => {
        const app = new aws_cdk_lib_1.App();
        const stack = new photobooth_stack_1.PhotoboothStack(app, 'TestStack', {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
            environmentConfig: environments_1.environments.dev,
        });
        // Should not throw during synthesis
        expect(() => {
            app.synth();
        }).not.toThrow();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaWMtaW5mcmFzdHJ1Y3R1cmUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhc2ljLWluZnJhc3RydWN0dXJlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7QUFFSCw2Q0FBa0M7QUFDbEMsdURBQWtEO0FBQ2xELHFFQUFpRTtBQUNqRSw2REFBMEQ7QUFFMUQsUUFBUSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtJQUMxQyxJQUFJLENBQUMsbUNBQW1DLEVBQUUsR0FBRyxFQUFFO1FBQzdDLE1BQU0sR0FBRyxHQUFHLElBQUksaUJBQUcsRUFBRSxDQUFDO1FBRXRCLHVDQUF1QztRQUN2QyxNQUFNLEtBQUssR0FBRyxJQUFJLGtDQUFlLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRTtZQUNsRCxHQUFHLEVBQUU7Z0JBQ0gsT0FBTyxFQUFFLGNBQWM7Z0JBQ3ZCLE1BQU0sRUFBRSxXQUFXO2FBQ3BCO1lBQ0QsaUJBQWlCLEVBQUUsMkJBQVksQ0FBQyxHQUFHO1NBQ3BDLENBQUMsQ0FBQztRQUVILG1CQUFtQjtRQUNuQixNQUFNLFFBQVEsR0FBRyxxQkFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUzQyxtQkFBbUI7UUFDbkIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQy9CLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUU7UUFDbkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBRyxFQUFFLENBQUM7UUFDdEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxrQ0FBZSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUU7WUFDbEQsR0FBRyxFQUFFO2dCQUNILE9BQU8sRUFBRSxjQUFjO2dCQUN2QixNQUFNLEVBQUUsV0FBVzthQUNwQjtZQUNE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QyxLQUFLLEVBQUUsQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNuQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEJhc2ljIEluZnJhc3RydWN0dXJlIFRlc3RzXHJcbiAqIFNpbXBsZSB0ZXN0cyB0byB2ZXJpZnkgQ0RLIHN0YWNrIGNvbXBpbGF0aW9uXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQXBwIH0gZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBUZW1wbGF0ZSB9IGZyb20gJ2F3cy1jZGstbGliL2Fzc2VydGlvbnMnO1xyXG5pbXBvcnQgeyBQaG90b2Jvb3RoU3RhY2sgfSBmcm9tICcuLi9zcmMvc3RhY2tzL3Bob3RvYm9vdGgtc3RhY2snO1xyXG5pbXBvcnQgeyBlbnZpcm9ubWVudHMgfSBmcm9tICcuLi9zcmMvY29uZmlnL2Vudmlyb25tZW50cyc7XHJcblxyXG5kZXNjcmliZSgnQmFzaWMgSW5mcmFzdHJ1Y3R1cmUgVGVzdHMnLCAoKSA9PiB7XHJcbiAgdGVzdCgnQ0RLIHN0YWNrIGNvbXBpbGVzIHdpdGhvdXQgZXJyb3JzJywgKCkgPT4ge1xyXG4gICAgY29uc3QgYXBwID0gbmV3IEFwcCgpO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgc3RhY2sgd2l0aCB0ZXN0IGNvbmZpZ3VyYXRpb25cclxuICAgIGNvbnN0IHN0YWNrID0gbmV3IFBob3RvYm9vdGhTdGFjayhhcHAsICdUZXN0U3RhY2snLCB7XHJcbiAgICAgIGVudjoge1xyXG4gICAgICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxyXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVudmlyb25tZW50Q29uZmlnOiBlbnZpcm9ubWVudHMuZGV2LFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8vIFNob3VsZCBub3QgdGhyb3dcclxuICAgIGNvbnN0IHRlbXBsYXRlID0gVGVtcGxhdGUuZnJvbVN0YWNrKHN0YWNrKTtcclxuICAgIFxyXG4gICAgLy8gQmFzaWMgYXNzZXJ0aW9uc1xyXG4gICAgZXhwZWN0KHRlbXBsYXRlKS50b0JlRGVmaW5lZCgpO1xyXG4gICAgZXhwZWN0KHN0YWNrKS50b0JlRGVmaW5lZCgpO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KCdTdGFjayBjcmVhdGVzIFMzIGJ1Y2tldCcsICgpID0+IHtcclxuICAgIGNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcclxuICAgIGNvbnN0IHN0YWNrID0gbmV3IFBob3RvYm9vdGhTdGFjayhhcHAsICdUZXN0U3RhY2snLCB7XHJcbiAgICAgIGVudjoge1xyXG4gICAgICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxyXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVudmlyb25tZW50Q29uZmlnOiBlbnZpcm9ubWVudHMuZGV2LFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGNvbnN0IHRlbXBsYXRlID0gVGVtcGxhdGUuZnJvbVN0YWNrKHN0YWNrKTtcclxuICAgIFxyXG4gICAgLy8gU2hvdWxkIGhhdmUgYXQgbGVhc3Qgb25lIFMzIGJ1Y2tldFxyXG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKCdBV1M6OlMzOjpCdWNrZXQnLCAxKTtcclxuICB9KTtcclxuXHJcbiAgdGVzdCgnU3RhY2sgY3JlYXRlcyBEeW5hbW9EQiB0YWJsZXMnLCAoKSA9PiB7XHJcbiAgICBjb25zdCBhcHAgPSBuZXcgQXBwKCk7XHJcbiAgICBjb25zdCBzdGFjayA9IG5ldyBQaG90b2Jvb3RoU3RhY2soYXBwLCAnVGVzdFN0YWNrJywge1xyXG4gICAgICBlbnY6IHtcclxuICAgICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcclxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudENvbmZpZzogZW52aXJvbm1lbnRzLmRldixcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XHJcbiAgICBcclxuICAgIC8vIFNob3VsZCBoYXZlIER5bmFtb0RCIHRhYmxlc1xyXG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKCdBV1M6OkR5bmFtb0RCOjpUYWJsZScsIDIpO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KCdTdGFjayBjcmVhdGVzIEVDUyByZXNvdXJjZXMnLCAoKSA9PiB7XHJcbiAgICBjb25zdCBhcHAgPSBuZXcgQXBwKCk7XHJcbiAgICBjb25zdCBzdGFjayA9IG5ldyBQaG90b2Jvb3RoU3RhY2soYXBwLCAnVGVzdFN0YWNrJywge1xyXG4gICAgICBlbnY6IHtcclxuICAgICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcclxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudENvbmZpZzogZW52aXJvbm1lbnRzLmRldixcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XHJcbiAgICBcclxuICAgIC8vIFNob3VsZCBoYXZlIEVDUyBjbHVzdGVyXHJcbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6RUNTOjpDbHVzdGVyJywgMSk7XHJcbiAgICBcclxuICAgIC8vIFNob3VsZCBoYXZlIEVDUyBzZXJ2aWNlXHJcbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6RUNTOjpTZXJ2aWNlJywgMSk7XHJcbiAgICBcclxuICAgIC8vIFNob3VsZCBoYXZlIHRhc2sgZGVmaW5pdGlvblxyXG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKCdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLCAxKTtcclxuICB9KTtcclxuXHJcbiAgdGVzdCgnU3RhY2sgY3JlYXRlcyBsb2FkIGJhbGFuY2VyJywgKCkgPT4ge1xyXG4gICAgY29uc3QgYXBwID0gbmV3IEFwcCgpO1xyXG4gICAgY29uc3Qgc3RhY2sgPSBuZXcgUGhvdG9ib290aFN0YWNrKGFwcCwgJ1Rlc3RTdGFjaycsIHtcclxuICAgICAgZW52OiB7XHJcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXHJcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcclxuICAgICAgfSxcclxuICAgICAgZW52aXJvbm1lbnRDb25maWc6IGVudmlyb25tZW50cy5kZXYsXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgY29uc3QgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2soc3RhY2spO1xyXG4gICAgXHJcbiAgICAvLyBTaG91bGQgaGF2ZSBhcHBsaWNhdGlvbiBsb2FkIGJhbGFuY2VyXHJcbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6RWxhc3RpY0xvYWRCYWxhbmNpbmdWMjo6TG9hZEJhbGFuY2VyJywgMSk7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoJ1N0YWNrIHN5bnRoZXNpemVzIHN1Y2Nlc3NmdWxseScsICgpID0+IHtcclxuICAgIGNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcclxuICAgIGNvbnN0IHN0YWNrID0gbmV3IFBob3RvYm9vdGhTdGFjayhhcHAsICdUZXN0U3RhY2snLCB7XHJcbiAgICAgIGVudjoge1xyXG4gICAgICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxyXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVudmlyb25tZW50Q29uZmlnOiBlbnZpcm9ubWVudHMuZGV2LFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8vIFNob3VsZCBub3QgdGhyb3cgZHVyaW5nIHN5bnRoZXNpc1xyXG4gICAgZXhwZWN0KCgpID0+IHtcclxuICAgICAgYXBwLnN5bnRoKCk7XHJcbiAgICB9KS5ub3QudG9UaHJvdygpO1xyXG4gIH0pO1xyXG59KTsiXX0=