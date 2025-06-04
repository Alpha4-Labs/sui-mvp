module alpha_points::sui_ns_proxy {
    public struct SubnameMintedViaProxy has copy, drop {
        partner_cap_id: 0x2::object::ID,
        partner_address: address,
        user_address: address,
        subname: 0x1::string::String,
        parent_domain: 0x1::string::String,
        timestamp_ms: u64,
    }
    
    public struct SubnameMintedViaProxyCap<T0: copy + drop> has copy, drop {
        proxy_cap_id: 0x2::object::ID,
        parent_suins_nft_id: T0,
        partner_address: address,
        user_address: address,
        subname_label: 0x1::string::String,
        timestamp_ms: u64,
    }
    
    fun is_alphanumeric(arg0: u8) : bool {
        if (arg0 >= 48 && arg0 <= 57) {
            true
        } else {
            if (arg0 >= 65 && arg0 <= 90) {
                true
            } else {
                let v1 = arg0 >= 97 && arg0 <= 122;
                v1
            }
        }
    }
    
    fun is_valid_domain_char(arg0: u8) : bool {
        is_alphanumeric(arg0) || arg0 == 46
    }
    
    fun is_valid_parent_domain(arg0: &0x1::string::String) : bool {
        let v0 = 0x1::string::as_bytes(arg0);
        let mut v1 = 0;
        while (v1 < 0x1::vector::length<u8>(v0)) {
            if (!is_valid_domain_char(*0x1::vector::borrow<u8>(v0, v1))) {
                return false
            };
            v1 = v1 + 1;
        };
        true
    }
    
    fun is_valid_subname(arg0: &0x1::string::String) : bool {
        let v0 = 0x1::string::as_bytes(arg0);
        let mut v1 = 0;
        while (v1 < 0x1::vector::length<u8>(v0)) {
            if (!is_alphanumeric(*0x1::vector::borrow<u8>(v0, v1))) {
                return false
            };
            v1 = v1 + 1;
        };
        true
    }
    
    public entry fun proxy_mint_subname(arg0: &alpha_points::partner::PartnerCap, arg1: address, arg2: 0x1::string::String, arg3: 0x1::string::String, arg4: &mut 0x2::tx_context::TxContext) {
        assert!(!alpha_points::partner::get_paused(arg0), 2);
        assert!(is_valid_subname(&arg2), 1);
        assert!(is_valid_parent_domain(&arg3), 3);
        let v0 = SubnameMintedViaProxy{
            partner_cap_id  : 0x2::object::uid_to_inner(alpha_points::partner::get_id(arg0)), 
            partner_address : 0x2::object::uid_to_address(alpha_points::partner::get_id(arg0)), 
            user_address    : arg1, 
            subname         : arg2, 
            parent_domain   : arg3, 
            timestamp_ms    : 0x2::tx_context::epoch_timestamp_ms(arg4),
        };
        0x2::event::emit<SubnameMintedViaProxy>(v0);
    }
    
    public entry fun mint_subname_via_proxy_cap<T0: store + key>(
        proxy_cap: &mut alpha_points::partner::ProxyCap<T0>, 
        user_address: address, 
        subname_label: 0x1::string::String, 
        ctx: &mut 0x2::tx_context::TxContext
    ) {
        assert!(is_valid_subname(&subname_label), 1);
        let v0 = SubnameMintedViaProxyCap<0x2::object::ID>{
            proxy_cap_id        : 0x2::object::uid_to_inner(alpha_points::partner::get_proxy_cap_id<T0>(proxy_cap)), 
            parent_suins_nft_id : 0x2::object::id<T0>(alpha_points::partner::get_proxy_cap_suins_parent_nft_object_ref<T0>(proxy_cap)), 
            partner_address     : alpha_points::partner::get_proxy_cap_owner_address<T0>(proxy_cap), 
            user_address        : user_address, 
            subname_label       : subname_label, 
            timestamp_ms        : 0x2::tx_context::epoch_timestamp_ms(ctx),
        };
        0x2::event::emit<SubnameMintedViaProxyCap<0x2::object::ID>>(v0);
    }
    
}

