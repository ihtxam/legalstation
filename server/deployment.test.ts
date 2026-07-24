import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getDeploymentMode, isOnPremise, isSingleTenant } from "./deployment";

describe("deployment mode", () => {
  const prevMode = process.env.DEPLOYMENT_MODE;
  const prevSingle = process.env.SINGLE_TENANT;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = prevMode;
    if (prevSingle === undefined) delete process.env.SINGLE_TENANT;
    else process.env.SINGLE_TENANT = prevSingle;
  });

  beforeEach(() => {
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.SINGLE_TENANT;
  });

  it("defaults to saas", () => {
    expect(getDeploymentMode()).toBe("saas");
    expect(isOnPremise()).toBe(false);
  });

  it("detects on_premise aliases", () => {
    process.env.DEPLOYMENT_MODE = "on-premise";
    expect(getDeploymentMode()).toBe("on_premise");
    expect(isSingleTenant()).toBe(true);
  });

  it("allows forcing single tenant in saas", () => {
    process.env.DEPLOYMENT_MODE = "saas";
    process.env.SINGLE_TENANT = "true";
    expect(isSingleTenant()).toBe(true);
  });
});
