import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app


async def read_catalog():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        paths = ("/vendors", "/subscriptions", "/invoices")
        responses = await asyncio.gather(*(client.get(path) for path in paths))
        for response in responses:
            response.raise_for_status()
        return tuple(response.json() for response in responses)


def test_catalog_links_invoices_to_subscriptions_and_vendors():
    vendors, subscriptions, invoices = asyncio.run(read_catalog())
    vendor_ids = {vendor["id"] for vendor in vendors}
    subscription_ids = {subscription["id"] for subscription in subscriptions}

    assert len(vendor_ids) == len(vendors) > 0
    assert len(subscription_ids) == len(subscriptions) > 0
    assert {subscription["vendor_id"] for subscription in subscriptions} <= vendor_ids
    assert {invoice["subscription_id"] for invoice in invoices} <= subscription_ids
    assert len({invoice["id"] for invoice in invoices}) == len(invoices) > 0
    assert all(invoice["currency"] == "INR" and type(invoice["amount_minor"]) is int for invoice in invoices)
