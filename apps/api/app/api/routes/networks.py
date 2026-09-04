from fastapi import APIRouter

router = APIRouter(prefix="/networks", tags=["Networks"])


@router.get("/")
async def list_user_networks():
    """
    List user registered networks (Wi-Fi, Ethernet, 4G, 5G).
    (Implementation placeholder for subsequent feature tasks).
    """
    return {
        "networks": []
    }


@router.get("/compare")
async def compare_networks(network_a_id: str, network_b_id: str):
    """
    Head-to-head performance comparison between two saved network environments.
    (Implementation placeholder for subsequent feature tasks).
    """
    return {
        "network_a_id": network_a_id,
        "network_b_id": network_b_id,
        "comparison": {}
    }
