'use client';

export function Terminal() {
  return (
    <div className="w-full rounded-lg shadow-2xl overflow-hidden bg-gray-900 text-white font-mono text-sm">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-400 text-xs">payment-flow.ts</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="text-gray-400">// Sanctum Gateway Integration</div>
          <div>
            <span className="text-purple-400">const</span>{' '}
            <span className="text-blue-300">gateway</span> ={' '}
            <span className="text-purple-400">new</span>{' '}
            <span className="text-yellow-300">SanctumGatewayClient</span>();
          </div>
          <div className="mt-2">
            <span className="text-gray-400">// Get Jito tips for priority</span>
          </div>
          <div>
            <span className="text-purple-400">const</span> tips ={' '}
            <span className="text-purple-400">await</span> gateway.
            <span className="text-green-300">getTipInstructions</span>(feePayer);
          </div>
          <div className="mt-2">
            <span className="text-gray-400">// Multi-route delivery</span>
          </div>
          <div>
            <span className="text-purple-400">const</span> result ={' '}
            <span className="text-purple-400">await</span> gateway.
            <span className="text-green-300">sendTransaction</span>(tx);
          </div>
          <div className="mt-2 text-green-400">
            ✓ Payment confirmed in 0.8s
          </div>
        </div>
      </div>
    </div>
  );
}