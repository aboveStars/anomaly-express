import { NextFunction, Request, RequestHandler, Response } from "express";
import { collectRequest, createSDKRequestData } from "../helper/collectRequest";
import { PolicyManager } from "../helper/Policy";
import { AnomalyMiddlewareConfig } from "../interfaces/AnomalyMiddleware";

/**
 * Creates Express middleware for AI-powered security monitoring.
 * @param config - Configuration object for the Anomaly middleware
 * @param config.apiKey - Your API key for authentication with Anomaly AI servers
 * @param config.appId - Your application ID for identifying your app
 * @param config.blockRealtime - Whether to check for anomaly in real-time.
 * If true, the middleware will check for anomaly in real-time and block the request if anomaly is detected.
 * If false, the middleware will check for anomaly in our servers and send report to dashboard.
 * Default is false.
 * @returns Express middleware function
 */
export function Anomaly(config: AnomalyMiddlewareConfig): RequestHandler {
  const policyManager = new PolicyManager(
    config.blockRealtime,
    config.appId,
    config.apiKey
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only override res.send since res.json and other response methods call res.send internally
    const originalSend = res.send.bind(res);
    res.send = async function (this: Response, body: any) {
      res.send = originalSend;

      // Creating RequestCollectionData from the request.
      let requestCollectionData = createSDKRequestData(
        req,
        body,
        res.statusCode
      );

      // Modifying the requestCollectionData with the anomaly result if blockRealtime is true.
      if (config.blockRealtime)
        requestCollectionData = {
          ...requestCollectionData,
          anomaly: policyManager.checkRequestForAnomaly(requestCollectionData),
        };

      // Send collected request to Anomaly servers.
      collectRequest(requestCollectionData, config.apiKey, config.appId);

      // If requestCollectionData.anomaly is not null and is_anomaly is true (meaning anomaly is detected), send 403 response.
      if (
        requestCollectionData.anomaly &&
        requestCollectionData.anomaly.is_anomaly
      ) {
        return originalSend.call(this, {
          message: "Anomaly Detected.",
        });
      }
      // If requestCollectionData.anomaly is null (means not checked for anomaly)
      // or anomaly.is_anomaly is false (means anomaly is not detected), send the original response.
      else {
        return originalSend.call(this, body);
      }
    } as any;

    next();
  };
}
