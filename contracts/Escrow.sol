//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _id) external;
}

contract Escrow {
    address payable public seller;
    address public nftAddress;
    address public inspector;
    address public lender;

    modifier onlyBuyer(uint256 _tokenId) {
        require(msg.sender == buyer[_tokenId]);
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller);
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector);
        _;
    }

    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping(uint256 => uint256) public escrowAmount;
    mapping(uint256 => address) public buyer;
    mapping(uint256 => bool) public inspectionPassed;
    mapping(uint256 => mapping(address => bool)) public approvalStatus;

    constructor(
        address _nftAddress,
        address _inspector,
        address _lender,
        address payable _seller
    ) {
        seller = _seller;
        nftAddress = _nftAddress;
        inspector = _inspector;
        lender = _lender;
    }

    function list(
        uint256 _tokenId,
        uint256 _purchasePrice,
        uint256 _escrowAmount,
        address _buyer
    ) public payable onlySeller {
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _tokenId);
        isListed[_tokenId] = true;
        purchasePrice[_tokenId] = _purchasePrice;
        escrowAmount[_tokenId] = _escrowAmount;
        buyer[_tokenId] = _buyer;
    }

    function depositEarnestMoney(
        uint256 _tokenId
    ) public payable onlyBuyer(_tokenId) {
        require(msg.value >= escrowAmount[_tokenId]);
    }

    receive() external payable {}

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Update Inspection Status (only inspector)
    function updateInspectionStatus(
        uint256 _nftID,
        bool _passed
    ) public onlyInspector {
        inspectionPassed[_nftID] = _passed;
    }

    function approveSale(uint256 _tokenId) public {
        approvalStatus[_tokenId][msg.sender] = true;
    }

    function finalizeSale(uint256 _tokenId) public {
        require(inspectionPassed[_tokenId]);
        require(approvalStatus[_tokenId][seller]);
        require(approvalStatus[_tokenId][lender]);
        require(approvalStatus[_tokenId][buyer[_tokenId]]);
        require(address(this).balance >= purchasePrice[_tokenId],"insufficient funds");
        isListed[_tokenId] = false;

        (bool success, ) = payable(seller).call{value: purchasePrice[_tokenId]}(
            ""
        );
        require(success);
        IERC721(nftAddress).transferFrom(
            address(this),
            buyer[_tokenId],
            _tokenId
        );
    }
}
