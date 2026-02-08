const {
  DynamoDBClient,
  ScanCommand,
  BatchWriteItemCommand,
} = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "ap-southeast-1" });
const TableName = "OpenNextDemoStack-CacheTableC1E6DF7E-10SOXSERAJAS8";

async function clearTable() {
  console.log(`Scanning table ${TableName}...`);
  const scan = await client.send(new ScanCommand({ TableName }));

  if (!scan.Items || scan.Items.length === 0) {
    console.log("Table is empty.");
    return;
  }

  console.log(`Found ${scan.Items.length} items. Deleting...`);

  // Batch delete (max 25 items per batch)
  const items = scan.Items;
  const batches = [];
  while (items.length > 0) {
    batches.push(items.splice(0, 25));
  }

  for (const batch of batches) {
    const deleteRequests = batch.map((item) => ({
      DeleteRequest: {
        Key: {
          path: item.path,
          tag: item.tag,
        },
      },
    }));

    await client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [TableName]: deleteRequests,
        },
      }),
    );
    console.log(`Deleted batch of ${batch.length} items`);
  }
  console.log("Table cleared.");
}

clearTable().catch(console.error);
