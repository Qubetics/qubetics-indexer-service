// export const ERC20ABI: any = [
// 	{
// 		constant: true,
// 		inputs: [],
// 		name: 'name',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'string'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'view',
// 		type: 'function'
// 	},
// 	{
// 		constant: false,
// 		inputs: [
// 			{
// 				name: '_spender',
// 				type: 'address'
// 			},
// 			{
// 				name: '_value',
// 				type: 'uint256'
// 			}
// 		],
// 		name: 'approve',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'bool'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'nonpayable',
// 		type: 'function'
// 	},
// 	{
// 		constant: true,
// 		inputs: [],
// 		name: 'totalSupply',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'uint256'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'view',
// 		type: 'function'
// 	},
// 	{
// 		constant: false,
// 		inputs: [
// 			{
// 				name: '_from',
// 				type: 'address'
// 			},
// 			{
// 				name: '_to',
// 				type: 'address'
// 			},
// 			{
// 				name: '_value',
// 				type: 'uint256'
// 			}
// 		],
// 		name: 'transferFrom',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'bool'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'nonpayable',
// 		type: 'function'
// 	},
// 	{
// 		constant: true,
// 		inputs: [],
// 		name: 'decimals',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'uint8'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'view',
// 		type: 'function'
// 	},
// 	{
// 		constant: true,
// 		inputs: [
// 			{
// 				name: '_owner',
// 				type: 'address'
// 			}
// 		],
// 		name: 'balanceOf',
// 		outputs: [
// 			{
// 				name: 'balance',
// 				type: 'uint256'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'view',
// 		type: 'function'
// 	},
// 	{
// 		constant: true,
// 		inputs: [],
// 		name: 'symbol',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'string'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'view',
// 		type: 'function'
// 	},
// 	{
// 		constant: false,
// 		inputs: [
// 			{
// 				name: '_to',
// 				type: 'address'
// 			},
// 			{
// 				name: '_value',
// 				type: 'uint256'
// 			}
// 		],
// 		name: 'transfer',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'bool'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'nonpayable',
// 		type: 'function'
// 	},
// 	{
// 		constant: true,
// 		inputs: [
// 			{
// 				name: '_owner',
// 				type: 'address'
// 			},
// 			{
// 				name: '_spender',
// 				type: 'address'
// 			}
// 		],
// 		name: 'allowance',
// 		outputs: [
// 			{
// 				name: '',
// 				type: 'uint256'
// 			}
// 		],
// 		payable: false,
// 		stateMutability: 'view',
// 		type: 'function'
// 	},
// 	{
// 		payable: true,
// 		stateMutability: 'payable',
// 		type: 'fallback'
// 	},
// 	{
// 		anonymous: false,
// 		inputs: [
// 			{
// 				'indexed': true,
// 				name: 'owner',
// 				type: 'address'
// 			},
// 			{
// 				'indexed': true,
// 				name: 'spender',
// 				type: 'address'
// 			},
// 			{
// 				'indexed': false,
// 				name: 'value',
// 				type: 'uint256'
// 			}
// 		],
// 		name: 'Approval',
// 		type: 'event'
// 	},
// 	{
// 		anonymous: false,
// 		inputs: [
// 			{
// 				'indexed': true,
// 				name: 'from',
// 				type: 'address'
// 			},
// 			{
// 				'indexed': true,
// 				name: 'to',
// 				type: 'address'
// 			},
// 			{
// 				'indexed': false,
// 				name: 'value',
// 				type: 'uint256'
// 			}
// 		],
// 		name: 'Transfer',
// 		type: 'event'
// 	}
// ];


export const ERC20ABI: any = [
	{
		inputs: [],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "allowance",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "needed",
				type: "uint256"
			}
		],
		name: "ERC20InsufficientAllowance",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "sender",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "balance",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "needed",
				type: "uint256"
			}
		],
		name: "ERC20InsufficientBalance",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "approver",
				type: "address"
			}
		],
		name: "ERC20InvalidApprover",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			}
		],
		name: "ERC20InvalidReceiver",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "sender",
				type: "address"
			}
		],
		name: "ERC20InvalidSender",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address"
			}
		],
		name: "ERC20InvalidSpender",
		type: "error"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "spender",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "Approval",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "Transfer",
		type: "event"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				internalType: "address",
				name: "spender",
				type: "address"
			}
		],
		name: "allowance",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "approve",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "balanceOf",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "decimals",
		outputs: [
			{
				internalType: "uint8",
				name: "",
				type: "uint8"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "mint",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [],
		name: "name",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "symbol",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "totalSupply",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "transfer",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "transferFrom",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];


export const ERC721ABI: any = [
	{
		inputs: [
			{
				internalType: "address",
				name: "initialOwner",
				type: "address"
			}
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		inputs: [],
		name: "ERC721EnumerableForbiddenBatchMint",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "sender",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "owner",
				type: "address"
			}
		],
		name: "ERC721IncorrectOwner",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "ERC721InsufficientApproval",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "approver",
				type: "address"
			}
		],
		name: "ERC721InvalidApprover",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			}
		],
		name: "ERC721InvalidOperator",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			}
		],
		name: "ERC721InvalidOwner",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			}
		],
		name: "ERC721InvalidReceiver",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "sender",
				type: "address"
			}
		],
		name: "ERC721InvalidSender",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "ERC721NonexistentToken",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "index",
				type: "uint256"
			}
		],
		name: "ERC721OutOfBoundsIndex",
		type: "error"
	},
	{
		inputs: [],
		name: "EnforcedPause",
		type: "error"
	},
	{
		inputs: [],
		name: "ExpectedPause",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			}
		],
		name: "OwnableInvalidOwner",
		type: "error"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "OwnableUnauthorizedAccount",
		type: "error"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "approved",
				type: "address"
			},
			{
				indexed: true,
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "Approval",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				indexed: false,
				internalType: "bool",
				name: "approved",
				type: "bool"
			}
		],
		name: "ApprovalForAll",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "_fromTokenId",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "_toTokenId",
				type: "uint256"
			}
		],
		name: "BatchMetadataUpdate",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "_tokenId",
				type: "uint256"
			}
		],
		name: "MetadataUpdate",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "previousOwner",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "newOwner",
				type: "address"
			}
		],
		name: "OwnershipTransferred",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "Paused",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				indexed: true,
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "Transfer",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "Unpaused",
		type: "event"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "approve",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			}
		],
		name: "balanceOf",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "burn",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "getApproved",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				internalType: "address",
				name: "operator",
				type: "address"
			}
		],
		name: "isApprovedForAll",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "name",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "owner",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "ownerOf",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "pause",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [],
		name: "paused",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "renounceOwnership",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "string[]",
				name: "uri",
				type: "string[]"
			}
		],
		name: "safeBatchMint",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "string",
				name: "uri",
				type: "string"
			}
		],
		name: "safeMint",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "safeTransferFrom",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes"
			}
		],
		name: "safeTransferFrom",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "bool",
				name: "approved",
				type: "bool"
			}
		],
		name: "setApprovalForAll",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes4",
				name: "interfaceId",
				type: "bytes4"
			}
		],
		name: "supportsInterface",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "symbol",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "index",
				type: "uint256"
			}
		],
		name: "tokenByIndex",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "index",
				type: "uint256"
			}
		],
		name: "tokenOfOwnerByIndex",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "tokenURI",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [],
		name: "totalSupply",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "transferFrom",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "newOwner",
				type: "address"
			}
		],
		name: "transferOwnership",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [],
		name: "unpause",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function"
	}
]