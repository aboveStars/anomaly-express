import { Request } from "express";
import { RequestCollectionDataFromSDK } from "../interfaces/Collection";
import { REQUEST_COLLECTION_ENDPOINT } from "../utils/config";
import { RequestInterfaceAtClickhouse } from "../interfaces/Request";

export function createSDKRequestData(
  req: Request,
  obj: any,
  statusCode: number,
  duration_ms: number
): RequestCollectionDataFromSDK {
  // Ensure body is properly stringified without double-stringification
  let bodyString: string;
  if (typeof obj === "string") {
    bodyString = obj;
  } else {
    bodyString = JSON.stringify(obj);
  }

  // Ensure headers are properly stringified without double-stringification (we don't need this but just in case)
  let headersString: string;
  if (typeof req.headers === "string") {
    headersString = req.headers;
  } else {
    headersString = JSON.stringify(req.headers);
  }

  const newSDKRequestData: RequestCollectionDataFromSDK = {
    body: bodyString,
    headers: headersString,
    ipAddress: req.ip || "",
    method: req.method,
    statusCode: statusCode || 0,
    timestamp: Math.floor(Date.now() / 1000),
    url: req.originalUrl,
    duration_ms: duration_ms,
    anomaly: null, // null for now, will be filled in by the SDK
    detected_by_policy_id: "", // empty string for now, will be filled in by the SDK or Server (depends if realtime blocking is enabled)
    blocked: 0, // 0 for now, will be filled in by the SDK
  };

  return newSDKRequestData;
}

/**
 * This function sends the request data to the AnomalyAI servers.
 * @param requestData - The request data to send to the AnomalyAI servers.
 * @param apiKey - The API key for the AnomalyAI servers.
 * @param appId - The app ID for the AnomalyAI servers.
 * @returns The request data at Clickhouse if the request is successful, false otherwise.
 */
async function sendRequestToAnomalyServers(
  requestData: RequestCollectionDataFromSDK,
  apiKey: string,
  appId: string
): Promise<RequestInterfaceAtClickhouse | false> {
  if (!REQUEST_COLLECTION_ENDPOINT) {
    console.error("REQUEST_COLLECTION_ENDPOINT is not set");
    return false;
  }

  try {
    const response = await fetch(REQUEST_COLLECTION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-app-id": appId,
      },
      body: JSON.stringify({
        requestDataFromSDK: requestData,
      }),
    });

    if (!response.ok) {
      console.error(
        "Response from request collection endpoint is not okay: ",
        await response.text()
      );

      return false;
    }

    const data = (await response.json()) as {
      newRequestDataAtClickhouse: RequestInterfaceAtClickhouse;
    };

    if (!data) {
      console.error(
        "Data is undefined from request collection endpoint response. ",
        data
      );
      return false;
    }

    if (!data.newRequestDataAtClickhouse) {
      console.error(
        "newRequestDataAtClickhouse is undefined from request collection endpoint response. ",
        data
      );
      return false;
    }

    return data.newRequestDataAtClickhouse;
  } catch (error) {
    console.error(
      "Error sending request to request collection endpoint: ",
      error
    );
    return false;
  }
}

/**
 * This function handles creating request collection object and sending it to AnomalyAI servers.
 * @param req
 * @param obj
 */
export async function collectRequest(
  requestDataFromSDK: RequestCollectionDataFromSDK,
  apiKey: string,
  appId: string
): Promise<RequestInterfaceAtClickhouse | false> {
  return await sendRequestToAnomalyServers(requestDataFromSDK, apiKey, appId);
}
