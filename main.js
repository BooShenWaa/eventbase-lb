// AWS SDK Imports
const {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetGroupAttributesCommand,
  RegisterTargetsCommand,
  DeregisterTargetsCommand,
} = require("@aws-sdk/client-elastic-load-balancing-v2");

const {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} = require("@aws-sdk/client-ec2");

const ec2Client = new EC2Client({
  region: "eu-west-2",
});

const elbClient = new ElasticLoadBalancingV2Client({
  region: "eu-west-2",
});

// Lambda Variables
let NLB_TARGET_GROUP_ARN = process.env.NLB_TARGET_GROUP_ARN;
let NLB_TARGET_PORT = process.env.NLB_TARGET_PORT;
let ALB_ARN = process.env.ALB_ARN;

// ARN Splitter
const splitter = require("aws-arn-splitter");

const GetResourceID = (arn) => {
  const splitedArn = splitter(arn);
  const array = splitedArn.path.split("/");
  const resourceId = array[array.length - 1];

  return resourceId;
};
// Working version
// Take in IP and register to the NLB Target Group
const RegisterNewTarget = async (
  NLB_TARGET_GROUP_ARN,
  NLB_TARGET_PORT,
  eventIp,
) => {
  const registerParams = {
    TargetGroupArn: NLB_TARGET_GROUP_ARN,
    Targets: [
      {
        Id: eventIp,
        Port: NLB_TARGET_PORT,
      },
    ],
  };

  try {
    const data = await elbClient.send(
      new RegisterTargetsCommand(registerParams),
    );
    console.log("trying");
    console.log(data);
    return data;
  } catch (error) {
    console.log("failing");
    console.log("Error: ", error);
    return error;
  }
};

const DeregisterTarget = async (NLB_TARGET_GROUP_ARN, NLB_TARGET_PORT, ip) => {
  const deregisterParams = {
    TargetGroupArn: NLB_TARGET_GROUP_ARN,
    Targets: [
      {
        Id: ip,
        Port: NLB_TARGET_PORT,
      },
    ],
  };

  try {
    const data = await elbClient.send(
      new DeregisterTargetsCommand(deregisterParams),
    );

    console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    return error;
  }
};

exports.handler = async (event) => {
  // Get the resourceID of the ALB from the ARN
  const ALB_RESOURCE_ID = GetResourceID(ALB_ARN);

  // Get Event type (Create or Delete Network Interface)
  const eventType = event.detail.eventName;

  // Pull required information from the event
  const eventDescription = event.detail.requestParameters.description;
  console.log(eventDescription);
  const eventResourceID = eventDescription.split("/")[2];

  // Newly created IP form the event
  const eventIP =
    event.detail.responseElements.networkInterface.privateIpAddress;

  // Confirm resource ID matches the ALB ID to proceed
  console.log(ALB_RESOURCE_ID == eventResourceID);

  if (ALB_RESOURCE_ID == eventResourceID) {
    switch (eventType) {
      case "CreateNetworkInterface":
        console.log("Attempting to register: ", eventIP);
        RegisterNewTarget(NLB_TARGET_GROUP_ARN, NLB_TARGET_PORT, eventIP);
        break;
      case "DeleteNetworkInterface":
        console.log("Attempting to deregister: ", eventIP);
        DeregisterTarget(NLB_TARGET_GROUP_ARN, NLB_TARGET_PORT, eventIP);
        break;
    }
  } else {
    console.log("Event does not match existing Application Load Balancer");
    return;
  }
};
