'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, ShoppingBag, Zap, Shield, Download, TrendingUp, Globe } from 'lucide-react';
import { Terminal } from './terminal';

export default function HomePage() {
  return (
    <main>
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-orange-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm font-medium mb-4">
                <Zap className="h-4 w-4 mr-2" />
                Powered by Sanctum Gateway
              </div>
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
                Digital Marketplace
                <span className="block text-orange-500">Built on Solana</span>
              </h1>
              <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                Sell digital products with instant USDC payments. No chargebacks, 
                no middlemen. Just you, your customers, and the blockchain.
              </p>
              <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0 flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="bg-orange-600 hover:bg-orange-700 rounded-full"
                  asChild
                >
                  <a href="/products">
                    Browse Marketplace
                    <ShoppingBag className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full"
                  asChild
                >
                  <a href="/dashboard/org/create">
                    Start Selling
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </div>
              <div className="mt-6 flex items-center gap-4 text-sm text-gray-600 sm:justify-center lg:justify-start">
                <div className="flex items-center">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-orange-200 border-2 border-white"></div>
                    <div className="w-8 h-8 rounded-full bg-blue-200 border-2 border-white"></div>
                    <div className="w-8 h-8 rounded-full bg-green-200 border-2 border-white"></div>
                  </div>
                  <span className="ml-3">100+ creators selling</span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <span>99.9% uptime</span>
              </div>
            </div>
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <Terminal />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Why Choose SubFlow?
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              The most reliable way to sell digital products on Solana
            </p>
          </div>
          
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-orange-500 text-white">
                <Zap className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-gray-900">
                  Lightning Fast Payments
                </h2>
                <p className="mt-2 text-base text-gray-500">
                  Powered by Sanctum Gateway for 99.9% payment reliability. 
                  Transactions confirm in seconds with multi-route delivery and Jito tips.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-orange-500 text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-gray-900">
                  Secure & Transparent
                </h2>
                <p className="mt-2 text-base text-gray-500">
                  All payments verified on-chain. No chargebacks, no fraud. 
                  Secure file delivery with expiring download links.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-orange-500 text-white">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-gray-900">
                  Keep 100% of Revenue
                </h2>
                <p className="mt-2 text-base text-gray-500">
                  Just $1 flat platform fee. No percentage cuts. 
                  Instant settlement to your wallet. You keep everything you earn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              From upload to sale in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-orange-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-orange-600">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Upload Product</h3>
              <p className="text-gray-600">
                Upload your digital product - courses, ebooks, templates, music, or software
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-orange-600">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Set Your Price</h3>
              <p className="text-gray-600">
                Price in USDC. Add description, images, and categories for discoverability
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-orange-600">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Customer Pays</h3>
              <p className="text-gray-600">
                Customers pay with any Solana wallet. Instant confirmation via Sanctum
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-orange-600">4</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Instant Delivery</h3>
              <p className="text-gray-600">
                Secure download link generated. Money in your wallet immediately
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-orange-600">99.9%</div>
              <div className="mt-2 text-gray-600">Payment Success Rate</div>
              <div className="mt-1 text-sm text-gray-500">Thanks to Sanctum Gateway</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-600">&lt;1s</div>
              <div className="mt-2 text-gray-600">Average Confirmation</div>
              <div className="mt-1 text-sm text-gray-500">Lightning fast on Solana</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-600">$1</div>
              <div className="mt-2 text-gray-600">Flat Platform Fee</div>
              <div className="mt-1 text-sm text-gray-500">Keep 100% of your price</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-orange-500 to-orange-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div className="text-white">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Ready to Start Selling?
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-orange-100">
                Join creators already selling digital products on Solana. 
                No setup fees, no monthly costs. Just upload and start earning.
              </p>
              <div className="mt-6 flex gap-4 text-sm">
                <div className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  <span>Secure payments</span>
                </div>
                <div className="flex items-center">
                  <Globe className="h-5 w-5 mr-2" />
                  <span>Global reach</span>
                </div>
                <div className="flex items-center">
                  <Download className="h-5 w-5 mr-2" />
                  <span>Instant delivery</span>
                </div>
              </div>
            </div>
            <div className="mt-8 lg:mt-0 flex flex-col sm:flex-row gap-4 justify-center lg:justify-end">
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full"
                asChild
              >
                <a href="/sign-up">
                  Create Account
                  <ArrowRight className="ml-3 h-6 w-6" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full bg-white/10 text-white border-white hover:bg-white/20"
                asChild
              >
                <a href="https://github.com/Emengkeng/SubFlow" target="_blank">
                  View on GitHub
                  <ArrowRight className="ml-3 h-6 w-6" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="py-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-400">
            Built with{' '}
            <a 
              href="https://gateway.sanctum.so" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Sanctum Gateway
            </a>
            {' '}• Powered by Solana • Made for Creators
          </p>
        </div>
      </section>
    </main>
  );
}