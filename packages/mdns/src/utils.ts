const isLocalhost = (address: string) =>
  address === '127.0.0.1' || address === '0.0.0.0' || address === '::1'

const isIPv6 = (address: string) => address.includes(':')

const isReachableIPv4 = (address: string) =>
  !isIPv6(address) && !isLocalhost(address)

interface ServiceAddressSource {
  readonly addresses?: readonly string[]
  readonly referer?: {
    readonly address?: string
  }
}

export const getReachableIPv4Addresses = (
  service: ServiceAddressSource
): string[] => {
  if (service.addresses && service.addresses.length > 0) {
    return service.addresses.filter(isReachableIPv4)
  }

  const address = service.referer?.address
  return address && isReachableIPv4(address) ? [address] : []
}
