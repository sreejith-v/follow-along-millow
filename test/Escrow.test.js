const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
    let escrow, realEstate;
    let seller, inspector, lender, buyer;

    beforeEach(async () => {
        [seller, inspector, lender, buyer] = await ethers.getSigners();
        const RealEstate = await ethers.getContractFactory('RealEstate');
        realEstate = await RealEstate.deploy();
        await realEstate.deployed();

        const ipfsUri = "ipfs://QmRandomUri"; // Replace with a random IPFS URI
        let transaction = await realEstate.connect(seller).mint(ipfsUri);
        await transaction.wait()

        // deploy Escrow contract
        const Escrow = await ethers.getContractFactory('Escrow');
        escrow = await Escrow.deploy(realEstate.address, inspector.address, lender.address, seller.address);
        await escrow.deployed();

        // approve the escrow contract to transfer the real estate
        transaction = await realEstate.connect(seller).approve(escrow.address, 1);
        await transaction.wait()
        // transfer ownership of the real estate to the escrow contract
        transaction = await escrow.connect(seller).list(1, tokens(10), tokens(5), buyer.address)
        await transaction.wait()



    });

    it('should deploy the Escrow contract and print the address', async () => {
        console.log('Escrow contract address:', realEstate.address);
        console.log('Real estate count:', await realEstate.totalSupply());
    });

    describe("Deployment", () => {
        it("Should set the right seller", async () => {
            expect(await escrow.seller()).to.equal(seller.address);
        });
        it("Should set the right inspector", async () => {
            expect(await escrow.inspector()).to.equal(inspector.address);
        });
        it("Should set the right lender", async () => {
            expect(await escrow.lender()).to.equal(lender.address);
        });
    })

    describe("Listing", () => {
        it("Should change ownership", async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
        });

        it("Should change islisted", async () => {
            expect(await escrow.isListed(1)).to.be.equal(true);
        });
        it("Should change purchasePrice", async () => {
            expect(await escrow.purchasePrice(1)).to.be.equal(tokens(10));
        });
        it("Should change escrowAmount", async () => {
            expect(await escrow.escrowAmount(1)).to.be.equal(tokens(5));
        });
        it("Should change buyer", async () => {
            expect(await escrow.buyer(1)).to.be.equal(buyer.address);
        });
    })

    describe("Deposit Earnest", () => {
        beforeEach(async () => {
            // deposit earnest
            transaction = await escrow.connect(buyer).depositEarnestMoney(1, { value: tokens(7) });
            await transaction.wait()
        })
        it("Should change earnestPaid", async () => {
            expect(await escrow.getBalance()).to.be.equal(tokens(7));
        });
    })

    describe("Inspection", () => {
        it("Should update inspection status", async () => {
            await escrow.connect(inspector).updateInspectionStatus(1, true);
            expect(await escrow.inspectionPassed(1)).to.be.equal(true);
        });
    })

    describe("Approval", () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(seller).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(lender).approveSale(1)
            await transaction.wait()
        })

        it("should update approval status", async () => {
            expect(await escrow.approvalStatus(1, buyer.address)).to.be.equal(true);
            expect(await escrow.approvalStatus(1, seller.address)).to.be.equal(true);
            expect(await escrow.approvalStatus(1, lender.address)).to.be.equal(true);
        })
    })

    describe('Sale', () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).depositEarnestMoney(1, { value: tokens(7) })
            await transaction.wait()

            transaction = await escrow.connect(inspector).updateInspectionStatus(1, true)
            await transaction.wait()

            transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(seller).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(lender).approveSale(1)
            await transaction.wait()

            await lender.sendTransaction({ to: escrow.address, value: tokens(3) })

            transaction = await escrow.connect(seller).finalizeSale(1)
            await transaction.wait()
        })

        it('Updates ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address)
        })

        it('Updates balance', async () => {
            expect(await escrow.getBalance()).to.be.equal(0)
        })
    })
})
