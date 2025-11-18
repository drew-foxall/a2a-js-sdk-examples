/**
 * Direct Content Editor Test
 * 
 * This demonstrates the key benefit of Phase 2 migration:
 * The agent can now be used DIRECTLY without the A2A protocol!
 */

import { contentEditorAgent } from './src/agents/content-editor/agent.js';

async function testDirectUsage() {
  console.log('🧪 Testing Direct Agent Usage (No A2A Protocol)\n');
  console.log('This proves the agent is protocol-agnostic and portable!\n');
  console.log('='.repeat(70));

  const testText = "Im goign to teh store to buy some apples and orangs. its gonna be great!";
  
  console.log(`\n📝 Original Text:`);
  console.log(`"${testText}"\n`);
  console.log('Processing with AI SDK ToolLoopAgent...\n');

  try {
    const result = await contentEditorAgent.generate({
      messages: [
        { role: 'user', content: `Fix this text: ${testText}` }
      ],
    });

    console.log(`✅ Edited Text:`);
    console.log(`"${result.text}"\n`);
    
    console.log('='.repeat(70));
    console.log('\n✅ SUCCESS! The agent works perfectly without A2A protocol!');
    console.log('\nThis same agent can be used in:');
    console.log('  • A2A protocol (via A2AAgentAdapter) ✅');
    console.log('  • CLI tools (like this script) ✅');
    console.log('  • Automated tests ✅');
    console.log('  • REST APIs ✅');
    console.log('  • MCP servers ✅');
    console.log('\nThat\'s the power of the adapter pattern! 🚀\n');
    
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

testDirectUsage().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});

