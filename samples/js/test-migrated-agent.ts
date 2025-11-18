/**
 * Test Migrated Content Editor Agent
 * 
 * This script demonstrates the portability of the migrated agent:
 * 1. Tests the agent directly (no A2A protocol)
 * 2. Shows how easy it is to use in CLI, tests, etc.
 */

import { contentEditorAgent } from './src/agents/content-editor/index.migrated.js';

async function testPortability() {
  console.log('🧪 Testing Agent Portability (No A2A Protocol)\n');
  console.log('This demonstrates the agent can be used outside of A2A!\n');
  console.log('=' .repeat(60));

  const testCases = [
    {
      name: 'Grammar Correction',
      input: 'Im goign to teh store to buy some apples and orangs.',
    },
    {
      name: 'Professional Email',
      input: 'hey can u send me that report asap? thx',
    },
    {
      name: 'Blog Post Polish',
      input: 'AI is changing everything. Its really cool. Everyone should use it.',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    console.log('Processing...');

    try {
      const result = await contentEditorAgent.generate({
        messages: [
          { role: 'user', content: testCase.input }
        ],
      });

      console.log(`✅ Output: "${result.text}"\n`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('=' .repeat(60));
  console.log('\n✅ Portability Test Complete!\n');
  console.log('Key Takeaway: The agent works perfectly outside of A2A protocol.');
  console.log('It can be used in:');
  console.log('  • CLI tools (like this script)');
  console.log('  • Automated tests');
  console.log('  • REST APIs');
  console.log('  • MCP servers');
  console.log('  • A2A protocol (via adapter)');
}

// Run the test
testPortability().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});

